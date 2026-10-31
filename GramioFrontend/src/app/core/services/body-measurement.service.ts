
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

import { BodyMeasurement, BodyMeasurementWrite } from '../models/body-measurement.model';

@Injectable({ providedIn: 'root' })
export class BodyMeasurementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/measurements`;

  getMeasurements(): Observable<BodyMeasurement[]> {
    return this.http.get<BodyMeasurement[]>(this.apiUrl);
  }

  createMeasurement(measurement: BodyMeasurementWrite): Observable<BodyMeasurement> {
    return this.http.post<BodyMeasurement>(this.apiUrl, measurement);
  }

  updateMeasurement(id: string, measurement: BodyMeasurementWrite): Observable<BodyMeasurement> {
    return this.http.put<BodyMeasurement>(`${this.apiUrl}/${id}`, measurement);
  }

  deleteMeasurement(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
