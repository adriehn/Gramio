import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import {
  BodyMeasurement,
  BodyMeasurementWrite
} from '../models/body-measurement.model';

@Injectable({ providedIn: 'root' })
export class BodyMeasurementService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly table = 'body_measurements';

  private authenticatedUserId(): Observable<string> {
    return defer(() => from(this.supabase.auth.getUser())).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data.user) throw new Error('unauthorized');
        return data.user.id;
      })
    );
  }

  getMeasurements(): Observable<BodyMeasurement[]> {
    return this.authenticatedUserId().pipe(
      switchMap((userId) =>
        from(
          this.supabase
            .from(this.table)
            .select('*')
            .eq('user_id', userId)
            .order('measured_on', { ascending: false })
            .order('created_at', { ascending: false })
        ).pipe(
          map(({ data, error }) => {
            if (error) throw error;
            return (data ?? []) as BodyMeasurement[];
          })
        )
      )
    );
  }

  createMeasurement(
    measurement: BodyMeasurementWrite
  ): Observable<BodyMeasurement> {
    return this.authenticatedUserId().pipe(
      switchMap((userId) =>
        from(
          this.supabase
            .from(this.table)
            .insert([{ ...measurement, user_id: userId }])
            .select('*')
            .single()
        ).pipe(
          map(({ data, error }) => {
            if (error) throw error;
            return data as BodyMeasurement;
          })
        )
      )
    );
  }

  updateMeasurement(
    id: string,
    measurement: BodyMeasurementWrite
  ): Observable<BodyMeasurement> {
    return this.authenticatedUserId().pipe(
      switchMap((userId) =>
        from(
          this.supabase
            .from(this.table)
            .update(measurement)
            .eq('id', id)
            .eq('user_id', userId)
            .select('*')
            .single()
        ).pipe(
          map(({ data, error }) => {
            if (error) throw error;
            return data as BodyMeasurement;
          })
        )
      )
    );
  }

  deleteMeasurement(id: string): Observable<void> {
    return this.authenticatedUserId().pipe(
      switchMap((userId) =>
        from(
          this.supabase
            .from(this.table)
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
        ).pipe(
          map(({ error }) => {
            if (error) throw error;
            return undefined;
          })
        )
      )
    );
  }
}
