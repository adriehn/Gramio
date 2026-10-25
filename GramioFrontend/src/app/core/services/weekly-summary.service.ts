import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WeeklySummaryResponse } from '../models/weekly-summary.model';

interface WeeklySummaryApiResponse {
    success: boolean;
    data: WeeklySummaryResponse;
}

@Injectable({ providedIn: 'root' })
export class WeeklySummaryService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/api/nutrition/weekly-summary`;

    getWeeklySummary(startDate: string): Observable<WeeklySummaryResponse> {
        const params = new HttpParams().set('startDate', startDate);

        return this.http
            .get<WeeklySummaryApiResponse>(this.baseUrl, { params })
            .pipe(map(response => response.data));
    }
}