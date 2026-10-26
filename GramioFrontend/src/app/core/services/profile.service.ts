
import { Injectable, inject, signal } from '@angular/core';
import { Observable, defer, from, of } from 'rxjs';
import {
  catchError,
  finalize,
  map,
  switchMap
} from 'rxjs';

import { SupabaseService } from './supabase.service';
import { MetabolicTargetRecord } from '../models/target.model';
import { normalizeAppError } from '../utils/error-handler.util';
import { AppError } from '../models/app-error.model';
import { Sex } from '../models/nutrition.model';

export interface UserProfile {
  sex: Sex;
  heightCm: number;
  birthDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private readonly supabase = inject(SupabaseService).client;

  readonly activeTarget = signal<MetabolicTargetRecord | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<AppError | null>(null);

  /**
   * Obtiene el perfil personal del usuario autenticado.
   */
  loadUserProfile(): Observable<UserProfile | null> {
    return defer(() =>
      from(this.supabase.auth.getUser())
    ).pipe(
      switchMap(({ data: { user }, error: authError }) => {
        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error('unauthorized');
        }

        return from(
          this.supabase
            .from('profiles')
            .select('sex, height_cm, birth_date')
            .eq('id', user.id)
            .maybeSingle()
        ).pipe(
          map(({ data, error }) => {
            if (error) {
              throw error;
            }

            if (!data) {
              return null;
            }

            return {
              sex: data.sex as Sex,
              heightCm: Number(data.height_cm),
              birthDate: data.birth_date
            };
          })
        );
      }),
      catchError((err: unknown) => {
        this.error.set(
          normalizeAppError(
            err,
            'No se pudo cargar el perfil personal.'
          )
        );

        return of(null);
      })
    );
  }

  /**
   * Actualiza los datos personales del usuario.
   */
  saveUserProfile(
    sex: Sex,
    heightCm: number,
  ): Observable<boolean> {
    return defer(() =>
      from(this.supabase.auth.getUser())
    ).pipe(
      switchMap(({ data: { user }, error: authError }) => {
        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error('unauthorized');
        }

        return from(
          this.supabase
            .from('profiles')
            .update({
              sex,
              height_cm: heightCm,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
        ).pipe(
          map(({ error }) => {
            if (error) {
              throw error;
            }

            return true;
          })
        );
      }),
      catchError((err: unknown) => {
        this.error.set(
          normalizeAppError(
            err,
            'No se pudo guardar el perfil personal.'
          )
        );

        return of(false);
      })
    );
  }
  updatePersonalData(displayName: string, birthDate: string): Observable<boolean> {
    return defer(() => from(this.supabase.auth.getUser())).pipe(
      switchMap(({ data: { user }, error: authError }) => {
        if (authError || !user) throw authError || new Error('unauthorized');

        return from(
          this.supabase
            .from('profiles')
            .update({
              display_name: displayName,
              birth_date: birthDate,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
        ).pipe(
          map(({ error }) => {
            if (error) throw error;
            return true;
          })
        );
      }),
      catchError((err: unknown) => {
        this.error.set(normalizeAppError(err, 'No se pudieron guardar los datos personales.'));
        return of(false);
      })
    );
  }

  /**
   * Carga el objetivo metabólico activo.
   */
  loadActiveTarget(): Observable<void> {
    return defer(() => {
      this.isLoading.set(true);
      this.error.set(null);

      return from(this.supabase.auth.getUser());
    }).pipe(
      switchMap(({ data: { user }, error: authError }) => {
        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error('unauthorized');
        }

        return from(
          this.supabase
            .from('metabolic_targets')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle()
        );
      }),
      map(({ data, error }) => {
        if (error) {
          throw error;
        }

        this.activeTarget.set(
          data as MetabolicTargetRecord | null
        );
      }),
      catchError((err: unknown) => {
        this.activeTarget.set(null);

        this.error.set(
          normalizeAppError(
            err,
            'No se pudo obtener el objetivo metabólico activo.'
          )
        );

        return of(undefined);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  /**
   * Desactiva el objetivo anterior y guarda el nuevo.
   * Mantiene el orden de las operaciones mediante switchMap.
   */
  saveTarget(
    target: Omit<
      MetabolicTargetRecord,
      'id' | 'user_id' | 'created_at'
    >
  ): Observable<boolean> {
    return defer(() => {
      this.isLoading.set(true);
      this.error.set(null);

      return from(this.supabase.auth.getUser());
    }).pipe(
      switchMap(({ data: { user }, error: authError }) => {
        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error('unauthorized');
        }

        return from(
          this.supabase
            .from('metabolic_targets')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('is_active', true)
        ).pipe(
          switchMap(({ error: deactivateError }) => {
            if (deactivateError) {
              throw deactivateError;
            }

            return from(
              this.supabase
                .from('metabolic_targets')
                .insert([{
                  ...target,
                  user_id: user.id,
                  is_active: true
                }])
                .select()
                .single()
            );
          }),
          map(({ data, error: insertError }) => {
            if (insertError) {
              throw insertError;
            }

            this.activeTarget.set(
              data as MetabolicTargetRecord
            );

            return true;
          })
        );
      }),
      catchError((err: unknown) => {
        this.error.set(
          normalizeAppError(
            err,
            'No fue posible guardar la configuración metabólica.'
          )
        );

        return of(false);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }
}
