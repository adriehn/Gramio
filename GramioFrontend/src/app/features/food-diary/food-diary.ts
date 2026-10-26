
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, Subject, catchError, distinctUntilChanged, finalize, of, switchMap, tap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FoodDiaryService, DiaryEntry, FoodItem, MealGroup, MealType } from '../../core/services/food-diary.service';
import { RecipeCreatorModal } from './recipe-creator-modal/recipe-creator-modal';
import { CreateRecipePayload } from '../../core/models/recipe.model';

@Component({
  selector: 'app-food-diary',
  standalone: true,
  imports: [CommonModule, FormsModule, RecipeCreatorModal],
  templateUrl: './food-diary.html',
  styleUrl: './food-diary.css'
})

export class FoodDiary {
  
  readonly diary = inject(FoodDiaryService);
  private readonly destroyRef = inject(DestroyRef);
  // 1. Agregá el signal para controlar la visibilidad del modal
  readonly showRecipeModal = signal(false);
  // Búsqueda de alimentos
  readonly searchTerm = signal('');
  readonly searchResults = signal<FoodItem[]>([]);
  readonly selectedFood = signal<FoodItem | null>(null);
  readonly grams = signal(100);
  readonly sessionClosed = signal(false);
  // Grupo de comida activo
  readonly groupType = signal<MealType>('breakfast');
  readonly groupLabel = signal('Desayuno');

  // Estados de interfaz
  readonly searching = signal(false);
  readonly localError = signal<string | null>(null);

  // Edición y eliminación de grupos
  readonly editingGroup = signal<MealGroup | null>(null);
  readonly editGroupLabel = signal('');
  readonly editGroupType = signal<MealType>('breakfast');

  readonly deletingGroup = signal<MealGroup | null>(null);
  readonly groupActionBusy = signal(false);

  private readonly searchTerms$ = new Subject<string>();
  // Edición de alimentos
  readonly editingEntry = signal<DiaryEntry | null>(null);
  readonly editSelectedFood = signal<FoodItem | null>(null);
  readonly editSearchTerm = signal('');
  readonly editSearchResults = signal<FoodItem[]>([]);
  readonly editGrams = signal(100);
  readonly editSearching = signal(false);
  readonly editSaving = signal(false);
  deleteEntryModal = signal<DiaryEntry | null>(null);
  showFinishDayModal = signal(false);
  readonly trainingNote = signal('');
  readonly closingDay = signal(false);
  private readonly editSearchTerms$ = new Subject<string>();
  
  readonly editNutrientPreview = computed(() => {
    const food = this.editSelectedFood();
    const grams = this.editGrams();

    if (!food || !Number.isFinite(grams) || grams <= 0 || grams > 10000) {
      return null;
    }

    const factor = grams / 100;

    return {
      kcal: Math.round(food.kcal_100 * factor * 10) / 10,
      protein: Math.round(food.protein_100 * factor * 10) / 10,
      carbs: Math.round(food.carbs_100 * factor * 10) / 10,
      fat: Math.round(food.fat_100 * factor * 10) / 10,
      fiber: Math.round(food.fiber_100 * factor * 10) / 10
    };
  });
  // Vista previa nutricional según la cantidad ingresada
  readonly nutrientPreview = computed(() => {
    const food = this.selectedFood();
    const grams = this.grams();

    if (!food || !Number.isFinite(grams) || grams <= 0) {
      return null;
    }

    const factor = grams / 100;

    return {
      kcal: food.kcal_100 * factor,
      protein: food.protein_100 * factor,
      carbs: food.carbs_100 * factor,
      fat: food.fat_100 * factor,
      fiber: food.fiber_100 * factor
    };
  });

  constructor() {
    this.initializeDiary();
    this.initializeFoodSearch();
  }

  // =========================================================
  // Inicialización
  // =========================================================

  private initializeDiary(): void {
    this.diary.initialize()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo cargar la información de la jornada.'
            )
          );
        }
      });
  }

  private initializeFoodSearch(): void {
    this.searchTerms$
      .pipe(
        distinctUntilChanged(),

        // Cada nuevo término cancela la búsqueda anterior,
        // incluso mientras todavía está esperando el debounce.
        switchMap(term => {
          const normalizedTerm = term.trim();

          if (normalizedTerm.length < 2) {
            this.searching.set(false);
            this.searchResults.set([]);

            return of([] as FoodItem[]);
          }

          this.searching.set(true);
          this.localError.set(null);

          return timer(250).pipe(
            switchMap(() => this.diary.searchFoods(normalizedTerm)),

            catchError((error: unknown) => {
              this.localError.set(
                this.getErrorMessage(
                  error,
                  'No se pudieron buscar los alimentos.'
                )
              );

              return of([] as FoodItem[]);
            }),

            finalize(() => this.searching.set(false))
          );
        }),

        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(results => {
        this.searchResults.set(results);
      });
    this.editSearchTerms$
      .pipe(
        distinctUntilChanged(),
        switchMap(term => {
          const query = term.trim();

          if (query.length < 2) {
            this.editSearching.set(false);
            this.editSearchResults.set([]);
            return of([] as FoodItem[]);
          }

          this.editSearching.set(true);

          return timer(250).pipe(
            switchMap(() => this.diary.searchFoods(query)),
            catchError((error: unknown) => {
              this.localError.set(
                this.getErrorMessage(
                  error,
                  'No se pudieron buscar alimentos para editar.'
                )
              );
              return of([] as FoodItem[]);
            }),
            finalize(() => this.editSearching.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(results => this.editSearchResults.set(results));
  }
  retryInitialize(): void {
    this.localError.set(null);
    this.diary.error.set(null);
    this.sessionClosed.set(false);

    this.diary.initialize()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo volver a cargar la jornada.'
            )
          );
        }
      });
  }
  openEditEntry(entry: DiaryEntry): void {
    const group = this.diary.groups().find(
      item => item.id === entry.meal_group_id
    );

    if (!group) {
      this.localError.set(
        'No se encontró el grupo al que pertenece el alimento.'
      );
      return;
    }

    if (!entry.food_id) {
      this.localError.set(
        'Esta entrada no tiene un alimento asociado que se pueda editar.'
      );
      return;
    }

    this.localError.set(null);
    this.editingEntry.set(entry);
    this.editSelectedFood.set(null);
    this.editSearchTerm.set(entry.name);
    this.editSearchResults.set([]);
    this.editGrams.set(Number(entry.quantity_g));

    this.diary.getFoodById(entry.food_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: food => {
          if (this.editingEntry()?.id === entry.id) {
            this.editSelectedFood.set(food);
          }
        },
        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo cargar el alimento para editar.'
            )
          );
        }
      });
  }

  onEditSearchChange(value: string): void {
    this.editSearchTerm.set(value);
    this.editSelectedFood.set(null);
    this.editSearchResults.set([]);
    this.editSearchTerms$.next(value);
  }

  selectEditFood(food: FoodItem): void {
    this.editSelectedFood.set(food);
    this.editSearchTerm.set(food.name);
    this.editSearchResults.set([]);
  }

  cancelEditEntry(): void {
    if (this.editSaving()) {
      return;
    }

    this.editingEntry.set(null);
    this.editSelectedFood.set(null);
    this.editSearchResults.set([]);
    this.editSearchTerm.set('');
  }
  saveEntryEdit(): void {
    if (this.editSaving()) {
      return;
    }

    const entry = this.editingEntry();
    const food = this.editSelectedFood();
    const grams = this.editGrams();

    if (!entry || !food) {
      this.localError.set('Seleccioná un alimento de los resultados.');
      return;
    }

    if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) {
      this.localError.set(
        'Ingresá una cantidad válida entre 0,1 y 10.000 gramos.'
      );
      return;
    }

    this.editSaving.set(true);
    this.localError.set(null);

    this.diary.updateEntry(entry.id, food, grams)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.editSaving.set(false))
      )
      .subscribe({
        next: () => {
          this.editingEntry.set(null);
          this.editSelectedFood.set(null);
          this.editSearchResults.set([]);
          this.editSearchTerm.set('');
        },
        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo guardar la edición del alimento.'
            )
          );
        }
      });
  }


  removeEntry(entry: DiaryEntry): void {
    const group = this.diary.groups().find(
      item => item.id === entry.meal_group_id
    );

    if (!group) {
      this.localError.set(
        'No se encontró el grupo al que pertenece el alimento.'
      );
      return;
    }

    this.localError.set(null);
    this.deleteEntryModal.set(entry);
  }

  cancelDeleteEntry(): void {
    this.deleteEntryModal.set(null);
  }

  confirmDeleteEntry(): void {
    const entry = this.deleteEntryModal();

    if (!entry) {
      return;
    }

    this.localError.set(null);

    this.diary.deleteEntry(entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteEntryModal.set(null);
        },
        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo eliminar el alimento.'
            )
          );
        }
      });
  }


  finishDay(): void {
    this.localError.set(null);
    this.diary.error.set(null);
    this.trainingNote.set('');
    this.showFinishDayModal.set(true);
  }

  cancelFinishDay(): void {
    if (this.closingDay()) return;
    this.showFinishDayModal.set(false);
  }

  confirmFinishDay(): void {
    if (this.closingDay() || !this.diary.session()) return;

    this.localError.set(null);
    this.closingDay.set(true);

    this.diary.closeSession(this.trainingNote().trim()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.closingDay.set(false))
    ).subscribe({
      next: () => {
        this.showFinishDayModal.set(false);
        this.trainingNote.set('');
      },
      error: (error: unknown) => {
        this.localError.set(
          this.getErrorMessage(error, 'No se pudo cerrar la jornada.')
        );
      }
    });
  }




  // =========================================================
  // Búsqueda y selección de alimentos
  // =========================================================

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.selectedFood.set(null);
    this.searchResults.set([]);
    this.localError.set(null);

    if (value.trim().length < 2) {
      this.searching.set(false);
    }

    this.searchTerms$.next(value);
  }

  selectFood(food: FoodItem): void {
    this.selectedFood.set(food);
    this.searchTerm.set(food.name);
    this.searchResults.set([]);
    this.searching.set(false);
    this.grams.set(100);
    this.localError.set(null);
  }

  // =========================================================
  // Registrar alimentos
  // =========================================================

  addFood(): void {
    const food = this.selectedFood();
    const grams = this.grams();

    if (!food) {
      this.localError.set(
        'Seleccioná un alimento de los resultados.'
      );
      return;
    }

    if (
      !Number.isFinite(grams) ||
      grams <= 0 ||
      grams > 10000
    ) {
      this.localError.set(
        'Ingresá una cantidad válida entre 0 y 10.000 gramos.'
      );
      return;
    }

    if (!this.diary.activeGroup()) {
      this.localError.set(
        'Primero creá un grupo de comida.'
      );
      return;
    }

    this.localError.set(null);

    this.diary.addFood(food, grams)
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.selectedFood.set(null);
          this.searchTerm.set('');
          this.searchResults.set([]);
          this.searching.set(false);
          this.grams.set(100);
        },

        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo registrar el alimento.'
            )
          );
        }
      });
  }

  // =========================================================
  // Crear y finalizar grupos
  // =========================================================

  createGroup(): void {
    const label = this.groupLabel().trim();

    if (!label || label.length > 80) {
      this.localError.set(
        'El nombre del grupo debe tener entre 1 y 80 caracteres.'
      );
      return;
    }

    this.localError.set(null);

    this.diary.createGroup(
      this.groupType(),
      label
    )
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.groupLabel.set(this.getDefaultGroupLabel(this.groupType()));
        },

        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo crear el grupo.'
            )
          );
        }
      });
  }

  private getDefaultGroupLabel(type: MealType): string {
    const labels: Record<MealType, string> = {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      snack: 'Merienda / colación',
      dinner: 'Cena',
      other: 'Otra comida'
    };

    return labels[type];
  }

  onGroupTypeChange(type: MealType): void {
    const labels: Record<MealType, string> = {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      snack: 'Merienda / colación',
      dinner: 'Cena',
      other: 'Otra comida'
    };

    this.groupType.set(type);
    this.groupLabel.set(labels[type]);
  }

  finishGroup(): void {
    this.localError.set(null);

    this.diary.closeActiveGroup()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo finalizar el grupo.'
            )
          );
        }
      });
  }



  // =========================================================
  // Cálculos por grupo
  // =========================================================

  entriesForGroup(groupId: string) {
    return this.diary.entries().filter(
      entry => entry.meal_group_id === groupId
    );
  }

  totalsForGroup(groupId: string) {
    return this.entriesForGroup(groupId).reduce(
      (total, entry) => ({
        kcal: total.kcal + Number(entry.kcal || 0),
        protein: total.protein + Number(entry.protein_g || 0),
        carbs: total.carbs + Number(entry.carbs_g || 0),
        fat: total.fat + Number(entry.fat_g || 0),
        fiber: total.fiber + Number(entry.fiber_g || 0)
      }),
      {
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0
      }
    );
  }

  formatNumber(value: number): string {
    return value.toLocaleString('es-AR', {
      maximumFractionDigits: 1
    });
  }

  // =========================================================
  // Editar grupos
  // =========================================================

  openEditGroup(group: MealGroup): void {
    if (this.groupActionBusy()) {
      return;
    }

    this.editingGroup.set(group);
    this.editGroupLabel.set(group.label);
    this.editGroupType.set(group.meal_type);
    this.localError.set(null);
  }

  cancelEditGroup(): void {
    if (!this.groupActionBusy()) {
      this.editingGroup.set(null);
    }
  }

  saveGroupEdit(): void {
    if (this.groupActionBusy()) {
      return;
    }

    const group = this.editingGroup();
    const label = this.editGroupLabel().trim();

    if (!group || !label || label.length > 80) {
      this.localError.set(
        'El nombre debe tener entre 1 y 80 caracteres.'
      );
      return;
    }

    this.groupActionBusy.set(true);
    this.localError.set(null);

    this.diary.updateGroup(
      group.id,
      this.editGroupType(),
      label
    )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.groupActionBusy.set(false))
      )
      .subscribe({
        next: () => {
          this.editingGroup.set(null);
        },

        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo editar el grupo.'
            )
          );
        }
      });
  }

  // =========================================================
  // Eliminar grupos
  // =========================================================

  requestDeleteGroup(group: MealGroup): void {
    if (this.groupActionBusy()) {
      return;
    }

    this.deletingGroup.set(group);
    this.localError.set(null);
  }

  cancelDeleteGroup(): void {
    if (!this.groupActionBusy()) {
      this.deletingGroup.set(null);
    }
  }

  confirmDeleteGroup(): void {
    if (this.groupActionBusy()) {
      return;
    }

    const group = this.deletingGroup();

    if (!group) {
      return;
    }

    this.groupActionBusy.set(true);
    this.localError.set(null);

    this.diary.deleteGroup(group.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.groupActionBusy.set(false))
      )
      .subscribe({
        next: () => {
          this.deletingGroup.set(null);
        },

        error: (error: unknown) => {
          this.localError.set(
            this.getErrorMessage(
              error,
              'No se pudo eliminar el grupo.'
            )
          );
        }
      });
  }

  // =========================================================
  // Manejo de errores
  // =========================================================

  private getErrorMessage(
    error: unknown,
    fallback: string
  ): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.length > 0
    ) {
      return error.message;
    }

    return fallback;
  }
  openRecipeModal(): void {
    this.localError.set(null);
    this.showRecipeModal.set(true);
  }

  onRecipeCreated(food: FoodItem): void {
    this.showRecipeModal.set(false);
    this.selectedFood.set(food);
    this.searchTerm.set(food.name);
    this.searchResults.set([]);
    this.grams.set(100);
    this.localError.set(null);
  }



}
