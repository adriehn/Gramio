
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ObservedTdeeResponse
} from '../models/observed-tdee.model';

interface ObservedTdeeApiResponse {
  success: boolean;
  data: ObservedTdeeResponse;
}

@Injectable({
  providedIn: 'root'
})
export class ObservedTdeeService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiUrl}/api/nutrition/observed-tdee`;

  getEstimate(): Observable<ObservedTdeeResponse> {
    return this.http
      .get<ObservedTdeeApiResponse>(this.baseUrl)
      .pipe(
        map(response => {
          if (!response?.success || !response.data) {
            throw new Error(
              'El servidor no devolvió una estimación válida.'
            );
          }

          return response.data;
        })
      );
  }
}
