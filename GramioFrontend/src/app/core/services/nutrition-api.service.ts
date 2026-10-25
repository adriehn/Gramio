import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { MetabolicInput, CalculatedTarget } from '../models/nutrition.model';
import { environment } from '../../../environments/environment'; // ej: apiUrl: 'http://localhost:3000/api'

@Injectable({
  providedIn: 'root'
})
export class NutritionApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/nutrition`;

  /**
   * Delega el cálculo pesado al backend (BFF)
   */
  calculateTarget(input: MetabolicInput): Observable<CalculatedTarget> {
    return this.http.post<{ success: boolean; data: CalculatedTarget; message: string }>(
      `${this.apiUrl}/calculate-target`, 
      input
    ).pipe(
      map(response => response.data)
    );
  }
}