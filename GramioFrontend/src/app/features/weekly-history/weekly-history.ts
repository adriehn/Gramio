
import { Component, inject, OnInit, ChangeDetectorRef, effect } from '@angular/core';
import { WeeklySummaryService } from '../../core/services/weekly-summary.service';
import { WeeklySummaryResponse } from '../../core/models/weekly-summary.model';
import { WeeklySummaryCardsComponent } from './components/weekly-summary-cards/weekly-summary-cards';
import { WeeklyDaysTableComponent } from './components/weekly-days-table/weekly-days-table';
import { ProfileService } from '@core/services/profile.service';

@Component({
  selector: 'app-weekly-history',
  standalone: true,
  imports: [WeeklySummaryCardsComponent, WeeklyDaysTableComponent],
  templateUrl: './weekly-history.html',
  styleUrl: './weekly-history.css',
})
export class WeeklyHistoryComponent implements OnInit {
  private readonly weeklySummaryService = inject(WeeklySummaryService);
  private readonly cdr = inject(ChangeDetectorRef);
  summary: WeeklySummaryResponse | null = null;
  loading = false;
  errorMessage = '';
  selectedWeekStart = this.getMonday(new Date());
  private requestId = 0;

  ngOnInit(): void {
    this.loadWeek();

  }

  //conectar con Profile Metabolic
  private readonly profileService = inject(ProfileService);
  constructor() {
    effect(() => {
      const target = this.profileService.activeTarget();
      if (target) {
        console.log('[Historial] Objetivo actualizado detectado, recargando semana...');
        this.loadWeek();
      }
    });
  }

  
  private getMonday(date: Date): string {
    const monday = new Date(date);
    monday.setHours(12, 0, 0, 0);

    const day = monday.getDay();
    const daysSinceMonday = (day + 6) % 7;

    monday.setDate(monday.getDate() - daysSinceMonday);

    return this.toDateString(monday);
  }

  private toDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  loadWeek(): void {
    const currentRequestId = ++this.requestId;

    this.loading = true;
    this.errorMessage = '';

    console.log('[Historial] Solicitando semana:', this.selectedWeekStart);

    this.weeklySummaryService.getWeeklySummary(this.selectedWeekStart).subscribe({
      next: (response) => {
        console.log('[Historial] Respuesta recibida:', response);

        if (currentRequestId !== this.requestId) {
          console.log('[Historial] Respuesta antigua ignorada');
          return;
        }

        this.summary = response;
        this.loading = false;
        this.cdr.detectChanges();
        console.log('[Historial] Loading:', this.loading);
        console.log('[Historial] Summary:', this.summary);
      },
      error: (error) => {
        console.error('[Historial] Error HTTP:', error);

        if (currentRequestId !== this.requestId) return;

        this.errorMessage = error.status === 401
          ? 'Tu sesión expiró. Volvé a iniciar sesión.'
          : 'No se pudo cargar el historial semanal. Intentá nuevamente.';

        this.loading = false;
      },
      complete: () => {
        console.log('[Historial] Observable completado');
      },

    });
  }

  previousWeek(): void {
    this.changeWeek(-7);
  }

  nextWeek(): void {
    this.changeWeek(7);
  }

  currentWeek(): void {
    this.selectedWeekStart = this.getMonday(new Date());
    this.loadWeek();
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    if (!value) return;

    this.selectedWeekStart = this.getMonday(new Date(`${value}T12:00:00`));
    this.loadWeek();
  }

  private changeWeek(days: number): void {
    const date = new Date(`${this.selectedWeekStart}T12:00:00`);
    date.setDate(date.getDate() + days);

    this.selectedWeekStart = this.toDateString(date);
    this.loadWeek();
  }

  get weekEnd(): string {
    const date = new Date(`${this.selectedWeekStart}T12:00:00`);
    date.setDate(date.getDate() + 6);

    return this.toDateString(date);
  }

  get weekLabel(): string {
    const start = new Date(`${this.selectedWeekStart}T12:00:00`);
    const end = new Date(`${this.weekEnd}T12:00:00`);

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
    };

    return `${start.toLocaleDateString('es-AR', options)} – ${end.toLocaleDateString('es-AR', {
      ...options,
      year: 'numeric',
    })}`;
  }

  get isCurrentWeek(): boolean {
    return this.selectedWeekStart === this.getMonday(new Date());
  }
}
