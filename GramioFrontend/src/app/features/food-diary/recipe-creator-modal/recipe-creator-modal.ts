import { Component, computed, inject, signal, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CreateRecipePayload } from '../../../core/models/recipe.model';
import { FoodDiaryService, FoodItem } from '../../../core/services/food-diary.service';

interface RecipeMacros {
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  fiber_100: number;
}

interface RecipeLine {
  key: number;
  name: string;
  source: 'database' | 'manual';
  quantity_g: number;
  food_id?: string;
  macros: RecipeMacros;
  manual_macros?: RecipeMacros;
}

@Component({
  selector: 'app-recipe-creator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipe-creator-modal.html',
  styleUrl: './recipe-creator-modal.css'
})
export class RecipeCreatorModal implements OnInit {
  private readonly diary = inject(FoodDiaryService);
  private readonly searchTerms$ = new Subject<string>();
  private nextLineKey = 0;

  // APIs modernas de Angular 17/18+ para Inputs y Outputs
  readonly editFoodId = input<string | null>(null);
  readonly close = output<void>();
  readonly created = output<FoodItem>();

  readonly name = signal('');
  readonly mode = signal<'database' | 'manual'>('database');
  readonly isCooked = signal(false);
  readonly loadingRecipe = signal(false);
  readonly searchTerm = signal('');
  readonly results = signal<FoodItem[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal<string | null>(null);

  readonly manualName = signal('');
  readonly manualQuantity = signal<number | null>(null);
  readonly manualKcal = signal<number | null>(null);
  readonly manualProtein = signal<number | null>(null);
  readonly manualCarbs = signal<number | null>(null);
  readonly manualFat = signal<number | null>(null);
  readonly manualFiber = signal<number | null>(null);

  readonly lines = signal<RecipeLine[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly totals = computed(() => {
    const lines = this.lines();

    const totalWeight = lines.reduce(
      (total, line) => total + line.quantity_g,
      0
    );

    const nutrients = lines.reduce(
      (total, line) => {
        const factor = line.quantity_g / 100;

        total.kcal += line.macros.kcal_100 * factor;
        total.protein += line.macros.protein_100 * factor;
        total.carbs += line.macros.carbs_100 * factor;
        total.fat += line.macros.fat_100 * factor;
        total.fiber += line.macros.fiber_100 * factor;

        return total;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    const cookedWeight = this.isCooked()
      ? totalWeight * 0.9
      : totalWeight;

    if (cookedWeight <= 0) {
      return {
        weight: 0,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0
      };
    }

    const to100g = (value: number): number =>
      (value / cookedWeight) * 100;

    return {
      weight: cookedWeight,
      kcal: to100g(nutrients.kcal),
      protein: to100g(nutrients.protein),
      carbs: to100g(nutrients.carbs),
      fat: to100g(nutrients.fat),
      fiber: to100g(nutrients.fiber)
    };
  });

  ngOnInit(): void {
    const foodId = this.editFoodId();
    if (foodId) {
      this.loadRecipeForEditing(foodId);
    }
  }

  private loadRecipeForEditing(foodId: string): void {
    this.loadingRecipe.set(true);
    this.error.set(null);

    this.diary.getCustomRecipe(foodId)
      .pipe(finalize(() => this.loadingRecipe.set(false)))
      .subscribe({
        next: (data) => {
          this.name.set(data.name);
          this.isCooked.set(data.is_cooked);

          const newLines = data.ingredients.map((ing: any) => ({
            key: this.nextLineKey++,
            name: ing.name,
            source: ing.source,
            quantity_g: ing.quantity_g,
            food_id: ing.food_id,
            macros: ing.macros,
            manual_macros: ing.manual_macros
          }));

          this.lines.set(newLines);
        },
        error: (err) => {
          this.error.set(err?.message || 'Error al cargar la receta.');
        }
      });
  }

  constructor() {
    this.searchTerms$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => {
          this.searchError.set(null);
          this.searchLoading.set(true);
        }),
        switchMap(term => {
          const query = term.trim();

          if (query.length < 2) {
            this.results.set([]);
            this.searchLoading.set(false);
            return of([] as FoodItem[]);
          }

          return this.diary.searchFoods(query).pipe(
            catchError(() => {
              this.searchError.set(
                'No se pudieron buscar los alimentos. Intentá nuevamente.'
              );
              return of([] as FoodItem[]);
            }),
            finalize(() => this.searchLoading.set(false))
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(results => this.results.set(results));
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.searchTerms$.next(term);
  }

  setMode(mode: 'database' | 'manual'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  addFood(food: FoodItem): void {
    this.lines.update(lines => [
      ...lines,
      {
        key: this.nextLineKey++,
        name: food.name,
        source: 'database',
        quantity_g: 100,
        food_id: food.id,
        macros: {
          kcal_100: this.nonNegative(food.kcal_100),
          protein_100: this.nonNegative(food.protein_100),
          carbs_100: this.nonNegative(food.carbs_100),
          fat_100: this.nonNegative(food.fat_100),
          fiber_100: this.nonNegative(food.fiber_100)
        }
      }
    ]);

    this.searchTerm.set('');
    this.results.set([]);
    this.searchError.set(null);
    this.searchTerms$.next('');
    this.error.set(null);
  }

  addManualIngredient(): void {
    const name = this.manualName().trim();
    const portion = this.manualQuantity();

    if (!name) {
      this.error.set('Ingresá el nombre del producto.');
      return;
    }

    if (!portion || portion <= 0) {
      this.error.set('La porción debe ser mayor que cero.');
      return;
    }

    const factor = 100 / portion;
    const round100g = (val: number | null) => Math.round((val || 0) * factor * 10) / 10;

    const macros: RecipeMacros = {
      kcal_100: round100g(this.manualKcal()),
      protein_100: round100g(this.manualProtein()),
      carbs_100: round100g(this.manualCarbs()),
      fat_100: round100g(this.manualFat()),
      fiber_100: round100g(this.manualFiber())
    };

    this.saving.set(true);
    this.error.set(null);

    const payload: CreateRecipePayload = {
      name: name,
      ingredients: [
        {
          source: 'manual',
          quantity_g: 100,
          manual_name: name,
          manual_macros: macros
        }
      ],
      is_cooked: false
    };

    this.diary.createRecipe(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (createdFood) => {
          this.lines.update(lines => [
            ...lines,
            {
              key: this.nextLineKey++,
              name: createdFood.name,
              source: 'database',
              quantity_g: portion,
              food_id: createdFood.id,
              macros: {
                kcal_100: createdFood.kcal_100,
                protein_100: createdFood.protein_100,
                carbs_100: createdFood.carbs_100,
                fat_100: createdFood.fat_100,
                fiber_100: createdFood.fiber_100
              }
            }
          ]);

          this.resetManualIngredient();
          this.error.set(null);
          this.setMode('database');
        },
        error: (err) => {
          this.error.set(err?.message || 'No se pudo guardar el ingrediente personalizado.');
        }
      });
  }

  updateQuantity(key: number, quantity: number): void {
    this.lines.update(lines =>
      lines.map(line =>
        line.key === key
          ? { ...line, quantity_g: this.isNonNegative(quantity) ? quantity : 0 }
          : line
      )
    );
    this.error.set(null);
  }

  removeLine(key: number): void {
    this.lines.update(lines => lines.filter(line => line.key !== key));
    this.error.set(null);
  }

  toNumber(value: unknown): number {
    if (value === '' || value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      value = value.replace(',', '.');
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  toNullableNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'string') {
      value = value.replace(',', '.');
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  format(value: number): string {
    return value.toLocaleString('es-AR', {
      maximumFractionDigits: 1
    });
  }

  requestClose(): void {
    if (!this.saving()) {
      this.close.emit();
    }
  }

  save(): void {
    if (this.saving()) return;

    const recipeName = this.name().trim();
    const lines = this.lines();

    if (!recipeName) {
      this.error.set('Ingresá el nombre de la receta.');
      return;
    }

    if (lines.length === 0) {
      this.error.set('Agregá al menos un ingrediente.');
      return;
    }

    const dbFoodIds = lines.filter(l => l.source === 'database' && l.food_id).map(l => l.food_id);
    const hasDuplicates = new Set(dbFoodIds).size !== dbFoodIds.length;
    if (hasDuplicates) {
      this.error.set('Tenés alimentos duplicados en la lista. Unificá las cantidades en una sola línea.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload: CreateRecipePayload = {
      name: recipeName,
      ingredients: lines.map(line => {
        if (line.source === 'database') {
          return {
            source: 'database' as const,
            quantity_g: line.quantity_g,
            food_id: line.food_id!
          };
        } else {
          return {
            source: 'manual' as const,
            quantity_g: line.quantity_g,
            manual_name: line.name,
            manual_macros: line.manual_macros!
          };
        }
      }),
      is_cooked: this.isCooked()
    };

    const foodId = this.editFoodId();
    const request$ = foodId
      ? this.diary.updateCustomRecipe(foodId, payload)
      : this.diary.createRecipe(payload);

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: savedFood => {
          this.created.emit(savedFood);
        },
        error: err => {
          this.error.set(err?.message || 'No se pudo guardar la receta.');
        }
      });
  }




  resetManualIngredient(): void {
    this.manualName.set('');
    this.manualQuantity.set(null);
    this.manualKcal.set(null);
    this.manualProtein.set(null);
    this.manualCarbs.set(null);
    this.manualFat.set(null);
    this.manualFiber.set(null);
  }

  private isNonNegative(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  private nonNegative(value: number | null | undefined): number {
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0
      ? value
      : 0;
  }
}