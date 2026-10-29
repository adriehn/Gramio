import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';
import { CreateRecipePayload } from '../models/recipe.model';

export type MealType =
    | 'breakfast'
    | 'lunch'
    | 'snack'
    | 'dinner'
    | 'other';

// 1. En food-diary.service.ts, actualiza la interfaz:
export interface FoodItem {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    kcal_100: number;
    protein_100: number;
    carbs_100: number;
    fat_100: number;
    fiber_100: number;
    user_id?: string;
    is_custom?: boolean;
}

export interface DiarySession {
    id: string;
    user_id: string;
    started_at: string;
    expires_at: string;
    status: 'open' | 'closed' | 'expired';
}

export interface MealGroup {
    id: string;
    session_id: string;
    user_id: string;
    meal_type: MealType;
    label: string;
    group_order: number;
    status: 'open' | 'closed';
    created_at: string;
    closed_at: string | null;
}

export interface DiaryEntry {
    id: string;
    session_id: string | null;
    meal_group_id: string | null;
    food_id: string | null;
    name: string;
    quantity_g: number;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    log_date: string;
    created_at: string;
}

@Injectable({ providedIn: 'root' })
export class FoodDiaryService {
    private readonly supabase = inject(SupabaseService);

    readonly session = signal<DiarySession | null>(null);
    readonly groups = signal<MealGroup[]>([]);
    readonly entries = signal<DiaryEntry[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    readonly activeGroup = computed(
        () => this.groups().find(group => group.status === 'open') ?? null
    );

    readonly dailyTotals = computed(() =>
        this.entries().reduce(
            (total, entry) => ({
                kcal: total.kcal + Number(entry.kcal || 0),
                protein: total.protein + Number(entry.protein_g || 0),
                carbs: total.carbs + Number(entry.carbs_g || 0),
                fat: total.fat + Number(entry.fat_g || 0),
                fiber: total.fiber + Number(entry.fiber_g || 0)
            }),
            { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        )
    );

    // Buscar alimentos disponibles para registrar o editar.
    searchFoods(term: string): Observable<FoodItem[]> {
        const query = term.trim();

        if (query.length < 2) {
            return from([[] as FoodItem[]]);
        }

        const lowerQuery = query.toLowerCase();

        return from(
            this.supabase.client
                .from('foods')
                .select('id,name,brand,category,kcal_100,protein_100,carbs_100,fat_100,fiber_100,user_id')
                .eq('is_archived', false)
                .ilike('name', `%${query}%`)
                .limit(50)
        ).pipe(
            map(({ data, error }) => {
                if (error) {
                    throw new Error(
                        `No se pudieron buscar alimentos: ${error.message}`
                    );
                }

                // MAPEO DINÁMICO: Evaluamos si es receta propia
                const items = (data ?? []).map(item => ({
                    ...item,
                    is_custom: item.category === 'recipe'
                })) as FoodItem[];

                return items
                    .sort((a, b) => {
                        const aName = a.name.toLowerCase();
                        const bName = b.name.toLowerCase();

                        const aStarts = aName.startsWith(lowerQuery);
                        const bStarts = bName.startsWith(lowerQuery);

                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;

                        return aName.localeCompare(bName);
                    })
                    .slice(0, 10);
            })
        );
    }

    // Obtener un alimento concreto para abrir el modal de edición.
    getFoodById(foodId: string): Observable<FoodItem> {
        return from(
            this.supabase.client
                .from('foods')
                .select(
                    'id,name,brand,category,kcal_100,protein_100,carbs_100,fat_100,fiber_100,user_id'
                )
                .eq('id', foodId)
                .maybeSingle()
        ).pipe(
            map(({ data, error }) => {
                if (error) {
                    throw new Error(
                        `No se pudo recuperar el alimento: ${error.message}`
                    );
                }

                if (!data) {
                    throw new Error('No se encontró el alimento original.');
                }

                // MAPEO DINÁMICO
                const item = data as FoodItem;
                item.is_custom = item.category === 'recipe';

                return item;
            })
        );
    }

    // Inicializar o recuperar la jornada actual.
    initialize(): Observable<void> {
        this.loading.set(true);
        this.error.set(null);

        return from(
            this.supabase.client.rpc('start_diary_session')
        ).pipe(
            map(({ data, error }) => {
                if (error) {
                    throw error;
                }

                const sessionData = Array.isArray(data) ? data[0] : data;

                if (!sessionData) {
                    throw new Error(
                        'No se pudo obtener la jornada de registro.'
                    );
                }

                return sessionData as DiarySession;
            }),
            tap(session => this.session.set(session)),
            switchMap(() => this.reloadSessionData()),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }

    // Crear un grupo nuevo y finalizar el anterior si estaba abierto.
    createGroup(mealType: MealType, label: string): Observable<void> {
        const session = this.session();

        if (!session) {
            return throwError(
                () => new Error('No hay una jornada activa.')
            );
        }

        this.loading.set(true);
        this.error.set(null);

        const currentGroup = this.activeGroup();
        const nextOrder =
            Math.max(0, ...this.groups().map(group => group.group_order)) + 1;

        const closePrevious$ = currentGroup
            ? from(
                this.supabase.client
                    .from('meal_groups')
                    .update({
                        status: 'closed',
                        closed_at: new Date().toISOString()
                    })
                    .eq('id', currentGroup.id)
                    .eq('session_id', session.id)
            ).pipe(
                map(({ error }) => {
                    if (error) {
                        throw error;
                    }
                })
            )
            : from([undefined]);

        return closePrevious$.pipe(
            switchMap(() =>
                from(
                    this.supabase.client
                        .from('meal_groups')
                        .insert({
                            session_id: session.id,
                            user_id: session.user_id,
                            meal_type: mealType,
                            label: label.trim() || this.defaultLabel(mealType),
                            group_order: nextOrder,
                            status: 'open'
                        })
                        .select('*')
                        .single()
                )
            ),
            map(({ data, error }) => {
                if (error) {
                    throw error;
                }

                return data as MealGroup;
            }),
            tap(newGroup => {
                this.groups.update(groups => [
                    ...groups.map(group =>
                        group.status === 'open'
                            ? { ...group, status: 'closed' as const }
                            : group
                    ),
                    newGroup
                ]);
            }),
            map(() => undefined),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }

    // Registrar un alimento en el grupo activo.
    addFood(food: FoodItem, grams: number): Observable<void> {
        const session = this.session();
        const group = this.activeGroup();

        if (!session || !group) {
            return throwError(
                () => new Error('Primero creá un grupo de comida.')
            );
        }

        if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) {
            return throwError(
                () => new Error('Ingresá una cantidad válida de gramos.')
            );
        }

        this.loading.set(true);
        this.error.set(null);

        return from(this.supabase.client.auth.getUser()).pipe(
            switchMap(({ data, error }) => {
                if (error || !data.user) {
                    throw new Error(
                        'Tu sesión de usuario no está disponible. Iniciá sesión nuevamente.'
                    );
                }

                const factor = grams / 100;
                const round = (value: number) =>
                    Math.round(value * factor * 10) / 10;

                return from(
                    this.supabase.client.from('daily_logs').insert({
                        user_id: data.user.id,
                        session_id: session.id,
                        meal_group_id: group.id,
                        log_date: this.localDate(),
                        entry_type: 'food',
                        food_id: food.id,
                        name: food.name,
                        quantity_g: grams,
                        kcal: round(food.kcal_100),
                        protein_g: round(food.protein_100),
                        carbs_g: round(food.carbs_100),
                        fat_g: round(food.fat_100),
                        fiber_g: round(food.fiber_100)
                    })
                );
            }),
            map(({ error }) => {
                if (error) {
                    throw error;
                }
            }),
            switchMap(() => this.reloadEntries(session.id)),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }

    // Editar un alimento existente y recalcular sus nutrientes en Supabase.

    // Editar un alimento existente y recalcular sus nutrientes en Supabase.
    updateEntry(
        entryId: string,
        food: FoodItem,
        grams: number
    ): Observable<void> {
        const session = this.session();

        if (!session || session.status !== 'open') {
            return throwError(
                () => new Error('La jornada ya está cerrada.')
            );
        }

        const entry = this.entries().find(item => item.id === entryId);

        if (!entry) {
            return throwError(
                () => new Error('No se encontró la entrada del alimento.')
            );
        }

        const group = this.groups().find(
            item => item.id === entry.meal_group_id
        );

        if (!group) {
            return throwError(
                () => new Error('No se encontró el grupo del alimento.')
            );
        }

        // Se permite editar aunque el grupo esté finalizado.
        // La jornada completa debe seguir abierta.
        if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) {
            return throwError(
                () => new Error(
                    'Ingresá una cantidad entre 0,1 y 10.000 gramos.'
                )
            );
        }

        this.loading.set(true);
        this.error.set(null);

        return from(
            this.supabase.client
                .from('daily_logs')
                .update({
                    food_id: food.id,
                    quantity_g: grams
                })
                .eq('id', entryId)
                .eq('session_id', session.id)
                .eq('user_id', session.user_id)
                .select('id')
                .single()
        ).pipe(
            map(({ data, error }) => {
                if (error) {
                    throw new Error(
                        `No se pudo actualizar el alimento: ${error.message}`
                    );
                }

                if (!data) {
                    throw new Error(
                        'No se encontró la entrada que querías editar.'
                    );
                }
            }),
            switchMap(() => this.reloadSessionData()),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }


    // Eliminar un alimento individual, solo si su grupo está abierto.

    // Eliminar un alimento mientras la jornada completa siga abierta.
    deleteEntry(entryId: string): Observable<void> {
        const session = this.session();

        if (!session || session.status !== 'open') {
            return throwError(
                () => new Error('La jornada ya está cerrada.')
            );
        }

        const entry = this.entries().find(item => item.id === entryId);

        if (!entry) {
            return throwError(
                () => new Error('No se encontró el alimento.')
            );
        }

        const group = this.groups().find(
            item => item.id === entry.meal_group_id
        );

        if (!group) {
            return throwError(
                () => new Error('No se encontró el grupo del alimento.')
            );
        }

        // No comprobamos group.status: puede estar cerrado
        // mientras la jornada todavía está abierta.
        this.loading.set(true);
        this.error.set(null);

        return from(
            this.supabase.client
                .from('daily_logs')
                .delete()
                .eq('id', entryId)
                .eq('session_id', session.id)
                .eq('user_id', session.user_id)
                .select('id')
                .single()
        ).pipe(
            map(({ data, error }) => {
                if (error) {
                    throw new Error(
                        `No se pudo eliminar el alimento: ${error.message}`
                    );
                }

                if (!data) {
                    throw new Error(
                        'No se encontró la entrada que querías eliminar.'
                    );
                }
            }),
            switchMap(() => this.reloadSessionData()),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }


    // Finalizar el grupo activo.
    closeActiveGroup(): Observable<void> {
        const group = this.activeGroup();
        const session = this.session();

        if (!group || !session) {
            return from([undefined]);
        }

        const closedAt = new Date().toISOString();

        return from(
            this.supabase.client
                .from('meal_groups')
                .update({
                    status: 'closed',
                    closed_at: closedAt
                })
                .eq('id', group.id)
                .eq('session_id', session.id)
        ).pipe(
            map(({ error }) => {
                if (error) {
                    throw error;
                }
            }),
            tap(() =>
                this.groups.update(groups =>
                    groups.map(item =>
                        item.id === group.id
                            ? {
                                ...item,
                                status: 'closed',
                                closed_at: closedAt
                            }
                            : item
                    )
                )
            ),
            catchError(error => this.handleError(error))
        );
    }

    // Cerrar la jornada completa.

    closeSession(trainingNote: string, logDate: string): Observable<void> {
        const session = this.session();

        if (!session) {
            return throwError(() => new Error('No hay una jornada activa para cerrar.'));
        }

        this.loading.set(true);
        this.error.set(null);

        return from(
            this.supabase.client.rpc('close_diary_session_with_note', {
                p_session_id: session.id,
                p_training_note: trainingNote.trim() || null,
                p_log_date: logDate // Pasamos la fecha a Supabase
            })
        ).pipe(
            tap(({ error }) => {
                if (error) throw error;

                this.session.set(null);
                this.groups.set([]);
                this.entries.set([]);
            }),
            map(() => undefined),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }

    createRecipe(payload: CreateRecipePayload): Observable<FoodItem> {
        return from(this.supabase.client.auth.getSession()).pipe(
            switchMap(({ data, error }) => {
                const token = data.session?.access_token;

                if (error || !token) {
                    return throwError(
                        () => new Error('Tu sesión expiró. Iniciá sesión nuevamente.')
                    );
                }

                return from(
                    fetch(`${environment.apiUrl}/api/nutrition/recipes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    }).then(async response => {
                        const body = await response.json().catch(() => null);

                        if (!response.ok || !body?.success || !body?.data) {
                            throw new Error(
                                body?.message || 'No se pudo guardar la receta.'
                            );
                        }

                        const recipe = body.data;

                        return {
                            id: recipe.food_id,
                            name: recipe.name,
                            brand: null,
                            category: 'recipe', // Coincide con tu backend
                            kcal_100: Number(recipe.kcal_100),
                            protein_100: Number(recipe.protein_100),
                            carbs_100: Number(recipe.carbs_100),
                            fat_100: Number(recipe.fat_100),
                            fiber_100: Number(recipe.fiber_100),
                            is_custom: true
                        } as FoodItem;
                    })
                );
            })
        );
    }
    // Obtener los detalles de una receta para editar
    getCustomRecipe(foodId: string): Observable<any> {
        return from(this.supabase.client.auth.getSession()).pipe(
            switchMap(({ data, error }) => {
                const token = data.session?.access_token;
                if (error || !token) throw new Error('Tu sesión expiró. Iniciá sesión nuevamente.');

                return from(
                    fetch(`${environment.apiUrl}/api/nutrition/recipes/${foodId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then(async response => {
                        const body = await response.json().catch(() => null);
                        if (!response.ok || !body?.success) {
                            throw new Error(body?.message || 'No se pudo cargar la receta.');
                        }
                        return body.data; // Debe retornar { name, is_cooked, ingredients: [...] }
                    })
                );
            })
        );
    }

    // Actualizar una receta existente
    updateCustomRecipe(foodId: string, payload: CreateRecipePayload): Observable<FoodItem> {
        return from(this.supabase.client.auth.getSession()).pipe(
            switchMap(({ data, error }) => {
                const token = data.session?.access_token;
                if (error || !token) throw new Error('Tu sesión expiró.');

                return from(
                    fetch(`${environment.apiUrl}/api/nutrition/recipes/${foodId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    }).then(async response => {
                        const body = await response.json().catch(() => null);
                        if (!response.ok || !body?.success || !body?.data) {
                            throw new Error(body?.message || 'No se pudo actualizar la receta.');
                        }

                        const recipe = body.data;
                        return {
                            id: recipe.food_id,
                            name: recipe.name,
                            brand: null,
                            category: 'recipe', // Importante para que lo tome como is_custom
                            kcal_100: Number(recipe.kcal_100),
                            protein_100: Number(recipe.protein_100),
                            carbs_100: Number(recipe.carbs_100),
                            fat_100: Number(recipe.fat_100),
                            fiber_100: Number(recipe.fiber_100),
                            is_custom: true
                        } as FoodItem;
                    })
                );
            })
        );
    }

    // Actualizar el nombre o tipo de un grupo.
    updateGroup(
        groupId: string,
        mealType: MealType,
        label: string
    ): Observable<void> {
        const session = this.session();

        if (!session || session.status !== 'open') {
            return throwError(
                () => new Error('La jornada ya está cerrada.')
            );
        }

        if (!this.groups().some(group => group.id === groupId)) {
            return throwError(
                () => new Error('No se encontró el subgrupo.')
            );
        }

        const cleanLabel = label.trim();

        if (!cleanLabel) {
            return throwError(
                () => new Error('El nombre del subgrupo es obligatorio.')
            );
        }

        this.loading.set(true);
        this.error.set(null);

        return from(
            this.supabase.client.rpc('edit_meal_group', {
                p_group_id: groupId,
                p_meal_type: mealType,
                p_label: label
            })
        ).pipe(
            map(({ error }) => {
                if (error) {
                    throw error;
                }
            }),
            switchMap(() => this.reloadSessionData()),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }

    // Eliminar un grupo mediante la función existente de Supabase.

    // Eliminar un grupo mientras la jornada completa siga abierta.
    deleteGroup(groupId: string): Observable<void> {
        const session = this.session();

        if (!session || session.status !== 'open') {
            return throwError(
                () => new Error('La jornada ya está cerrada.')
            );
        }

        const group = this.groups().find(item => item.id === groupId);

        if (!group) {
            return throwError(
                () => new Error('No se encontró el subgrupo.')
            );
        }

        // No bloqueamos la eliminación por group.status === 'closed'.
        this.loading.set(true);
        this.error.set(null);

        return from(
            this.supabase.client.rpc('delete_meal_group', {
                p_group_id: groupId
            })
        ).pipe(
            map(({ error }) => {
                if (error) {
                    throw new Error(
                        `No se pudo eliminar el grupo: ${error.message}`
                    );
                }
            }),
            switchMap(() => this.reloadSessionData()),
            catchError(error => this.handleError(error)),
            finalize(() => this.loading.set(false))
        );
    }


    // Recargar grupos y entradas de la jornada.
    private reloadSessionData(): Observable<void> {
        const session = this.session();

        if (!session) {
            return from([undefined]);
        }

        return from(
            this.supabase.client
                .from('meal_groups')
                .select('*')
                .eq('session_id', session.id)
                .order('group_order')
        ).pipe(
            map(({ data, error }) => {
                if (error) {
                    throw error;
                }

                this.groups.set((data ?? []) as MealGroup[]);
            }),
            switchMap(() => this.reloadEntries(session.id))
        );
    }

    // Recargar las entradas de una jornada.
    private reloadEntries(sessionId: string): Observable<void> {
        return from(
            this.supabase.client
                .from('daily_logs')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at')
        ).pipe(
            map(({ data, error }) => {
                if (error) {
                    throw error;
                }

                this.entries.set((data ?? []) as DiaryEntry[]);
            })
        );
    }

    private localDate(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    private defaultLabel(type: MealType): string {
        const labels: Record<MealType, string> = {
            breakfast: 'Desayuno',
            lunch: 'Almuerzo',
            snack: 'Merienda',
            dinner: 'Cena',
            other: 'Otra comida'
        };

        return labels[type];
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        if (
            typeof error === 'object' &&
            error !== null &&
            'message' in error
        ) {
            return String(error.message);
        }

        return 'Ocurrió un error inesperado al gestionar el registro diario.';
    }

    private handleError(error: unknown): Observable<never> {
        const message = this.getErrorMessage(error);
        this.error.set(message);

        return throwError(() => new Error(message));
    }
    // Eliminar una receta personalizada.
    deleteCustomRecipe(foodId: string): Observable<void> {
        return from(this.supabase.client.auth.getSession()).pipe(
            switchMap(({ data, error }) => {
                const token = data.session?.access_token;

                if (error || !token) {
                    return throwError(() => new Error('Tu sesión expiró. Iniciá sesión nuevamente.'));
                }

                return from(
                    fetch(`${environment.apiUrl}/api/nutrition/recipes/${foodId}`, {
                        method: 'DELETE',
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }).then(async response => {
                        const body = await response.json().catch(() => null);

                        if (!response.ok || !body?.success) {
                            throw new Error(body?.message || 'No se pudo eliminar la receta.');
                        }
                    })
                );
            })
        );
    }
    // Obtener todas las recetas personalizadas del usuario
    getMyRecipes(): Observable<FoodItem[]> {
        return from(this.supabase.client.auth.getUser()).pipe(
            switchMap(({ data, error }) => {
                if (error || !data.user) {
                    throw new Error('No se pudo verificar tu sesión.');
                }

                return from(
                    this.supabase.client
                        .from('foods')
                        .select('id,name,brand,category,kcal_100,protein_100,carbs_100,fat_100,fiber_100,user_id')
                        .eq('is_archived', false)
                        .eq('category', 'recipe')
                        .eq('user_id', data.user.id) // <- FILTRO CLAVE: Solo tus recetas
                        .order('name')
                );
            }),
            map(({ data, error }) => {
                if (error) {
                    throw new Error(`No se pudieron cargar tus recetas: ${error.message}`);
                }

                return (data ?? []).map(item => ({
                    ...item,
                    is_custom: true
                })) as FoodItem[];
            })
        );
    }
}