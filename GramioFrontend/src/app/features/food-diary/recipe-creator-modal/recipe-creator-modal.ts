import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
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
export class RecipeCreatorModal {
  private readonly diary = inject(FoodDiaryService);
  private readonly searchTerms$ = new Subject<string>();
  private nextLineKey = 0;

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly created = new EventEmitter<FoodItem>();

  readonly name = signal('');
  readonly mode = signal<'database' | 'manual'>('database');
  readonly isCooked = signal(false);

  readonly searchTerm = signal('');
  readonly results = signal<FoodItem[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal<string | null>(null);

  // Señales de inputs manuales permitiendo null para no forzar el "0"
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

    // Estima una pérdida del 10 % del peso al cocinar.
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

    // Normaliza los nutrientes según el peso final estimado.
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

    // Se calculan los valores a 100g para almacenar estandarizado
    const factor = 100 / portion;
    const round100g = (val: number | null) => Math.round((val || 0) * factor * 10) / 10;

    const macros: RecipeMacros = {
      kcal_100: round100g(this.manualKcal()),
      protein_100: round100g(this.manualProtein()),
      carbs_100: round100g(this.manualCarbs()),
      fat_100: round100g(this.manualFat()),
      fiber_100: round100g(this.manualFiber())
    };

    if (Object.values(macros).some(value => !this.isNonNegative(value))) {
      this.error.set('Los nutrientes deben ser números válidos.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    // Creamos un payload de "receta" con 1 solo ingrediente manual (así se guarda como alimento propio)
    const payload: CreateRecipePayload = {
      name: name,
      ingredients: [
        {
          source: 'manual',
          quantity_g: 100, // Lo enviamos por 100g porque ya escalamos los macros arriba
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
          // El backend ya lo guardó en la tabla foods. Lo agregamos como ingrediente de base de datos.
          this.lines.update(lines => [
            ...lines,
            {
              key: this.nextLineKey++,
              name: createdFood.name,
              source: 'database',
              quantity_g: portion, // Sugerimos la misma cantidad de la porción ingresada
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
          this.error.set(
            err?.error?.message ||
            err?.message ||
            'No se pudo guardar el ingrediente personalizado.'
          );
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

  // Conserva el comportamiento por defecto para inputs que necesitan siempre ser cero si vacíos
  toNumber(value: unknown): number {
    if (value === '' || value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Convierte el input en null cuando se borra, evitando que se clave en 0
  toNullableNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
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
    if (this.saving()) {
      return;
    }

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

    if (
      lines.some(
        line =>
          !this.isPositive(line.quantity_g) ||
          Object.values(line.macros).some(
            value => !this.isNonNegative(value)
          )
      )
    ) {
      this.error.set(
        'Revisá las cantidades y los nutrientes de los ingredientes.'
      );
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload: CreateRecipePayload = {
      name: recipeName,
      ingredients: lines.map(line => ({
        source: line.source,
        quantity_g: line.quantity_g,
        food_id: line.food_id,
        manual_name: line.source === 'manual' ? line.name : undefined,
        manual_macros: line.manual_macros
      })),
      is_cooked: this.isCooked()
    };

    this.diary.createRecipe(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: createdFood => {
          this.created.emit(createdFood);
        },
        error: err => {
          this.error.set(
            err?.error?.message ||
            err?.message ||
            'No se pudo crear la receta.'
          );
        }
      });
  }

  private resetManualIngredient(): void {
    this.manualName.set('');
    this.manualQuantity.set(null);
    this.manualKcal.set(null);
    this.manualProtein.set(null);
    this.manualCarbs.set(null);
    this.manualFat.set(null);
    this.manualFiber.set(null);
  }

  private isPositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
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