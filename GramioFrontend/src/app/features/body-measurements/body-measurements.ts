
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  BodyMeasurement,
  BodyMeasurementMetric,
  BodyMeasurementWrite,
  MeasurementMetricOption
} from '../../core/models/body-measurement.model';
import { BodyMeasurementService } from '../../core/services/body-measurement.service';
import { BodyMeasurementEducation } from './body-measuremen-education/body-measuremen-education';

type MeasurementForm = FormGroup<{
  measured_on: FormControl<string>;
  weight_kg: FormControl<number | null>;
  body_fat_pct: FormControl<number | null>;
  neck_cm: FormControl<number | null>;
  shoulders_cm: FormControl<number | null>;
  chest_cm: FormControl<number | null>;
  arm_relaxed_cm: FormControl<number | null>;
  arm_flexed_cm: FormControl<number | null>;
  waist_cm: FormControl<number | null>;
  hip_cm: FormControl<number | null>;
  thigh_cm: FormControl<number | null>;
  calf_cm: FormControl<number | null>;
  notes: FormControl<string>;
}>;

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  date: string;
  value: number;
}

interface ChartTick {
  value: number;
  y: number;
  label: string;
}

@Component({
  selector: 'app-body-measurements',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, BodyMeasurementEducation],
  templateUrl: './body-measurements.html',
  styleUrl: './body-measurements.css'
})
export class BodyMeasurements implements OnInit {
  private readonly service = inject(BodyMeasurementService);
  private readonly cdr = inject(ChangeDetectorRef);

  measurements: BodyMeasurement[] = [];
  loading = false;
  saving = false;
  deletingId: string | null = null;
  errorMessage = '';
  successMessage = '';
  formVisible = false;
  editingId: string | null = null;
  searchText = '';
  period: '3m' | '6m' | '1y' | 'all' = '6m';
  selectedMetric: BodyMeasurementMetric = 'weight_kg';
  compareFromId = '';
  compareToId = '';
  showDeleteConfirmId: string | null = null;
  hoveredChartDate: string | null = null;
  selectedChartDate: string | null = null;
  educationVisible = false;
  educationMetric: string | null = null;
  /** El mes se representa siempre con el día 1. */
  selectedMonth = this.firstDayOfMonth(new Date());

  readonly metricOptions: MeasurementMetricOption[] = [
    { key: 'weight_kg', label: 'Peso corporal', shortLabel: 'Peso', unit: 'kg' },
    { key: 'body_fat_pct', label: 'Grasa corporal', shortLabel: 'Grasa', unit: '%' },
    { key: 'waist_cm', label: 'Cintura', shortLabel: 'Cintura', unit: 'cm' },
    { key: 'chest_cm', label: 'Pecho', shortLabel: 'Pecho', unit: 'cm' },
    { key: 'arm_relaxed_cm', label: 'Brazo relajado', shortLabel: 'Brazo rel.', unit: 'cm' },
    { key: 'arm_flexed_cm', label: 'Brazo flexionado', shortLabel: 'Brazo flex.', unit: 'cm' },
    { key: 'hip_cm', label: 'Cadera', shortLabel: 'Cadera', unit: 'cm' },
    { key: 'thigh_cm', label: 'Muslo', shortLabel: 'Muslo', unit: 'cm' },
    { key: 'calf_cm', label: 'Pantorrilla', shortLabel: 'Pantorrilla', unit: 'cm' },
    { key: 'neck_cm', label: 'Cuello', shortLabel: 'Cuello', unit: 'cm' },
    { key: 'shoulders_cm', label: 'Hombros', shortLabel: 'Hombros', unit: 'cm' }
  ];

  readonly form: MeasurementForm = new FormGroup({
    measured_on: new FormControl(this.today(), {
      nonNullable: true,
      validators: [Validators.required]
    }),
    weight_kg: new FormControl<number | null>(null, [Validators.min(20), Validators.max(400)]),
    body_fat_pct: new FormControl<number | null>(null, [Validators.min(1), Validators.max(75)]),
    neck_cm: new FormControl<number | null>(null, [Validators.min(10), Validators.max(100)]),
    shoulders_cm: new FormControl<number | null>(null, [Validators.min(20), Validators.max(200)]),
    chest_cm: new FormControl<number | null>(null, [Validators.min(20), Validators.max(200)]),
    arm_relaxed_cm: new FormControl<number | null>(null, [Validators.min(10), Validators.max(100)]),
    arm_flexed_cm: new FormControl<number | null>(null, [Validators.min(10), Validators.max(100)]),
    waist_cm: new FormControl<number | null>(null, [Validators.min(20), Validators.max(200)]),
    hip_cm: new FormControl<number | null>(null, [Validators.min(20), Validators.max(200)]),
    thigh_cm: new FormControl<number | null>(null, [Validators.min(20), Validators.max(120)]),
    calf_cm: new FormControl<number | null>(null, [Validators.min(10), Validators.max(80)]),
    notes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)]
    })
  });

  ngOnInit(): void {
    this.loadMeasurements();
  }

  loadMeasurements(): void {
    this.loading = true;
    this.errorMessage = '';

    this.service.getMeasurements()
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: rows => {
          this.measurements = [...rows].sort((a, b) =>
            b.measured_on.localeCompare(a.measured_on)
          );

          this.compareToId = this.measurements[0]?.id ?? '';
          this.compareFromId = this.measurements[this.measurements.length - 1]?.id ?? '';
        },
        error: (error: unknown) => {
          this.errorMessage = this.readError(
            error,
            'No se pudieron cargar las mediciones.'
          );
        }
      });
  }

  openNewForm(): void {
    this.editingId = null;
    this.successMessage = '';
    this.errorMessage = '';

    this.form.reset({
      measured_on: this.today(),
      weight_kg: null,
      body_fat_pct: null,
      neck_cm: null,
      shoulders_cm: null,
      chest_cm: null,
      arm_relaxed_cm: null,
      arm_flexed_cm: null,
      waist_cm: null,
      hip_cm: null,
      thigh_cm: null,
      calf_cm: null,
      notes: ''
    });

    this.formVisible = true;
  }
  get activeChartPoint(): (ChartPoint & {
    tooltipX: number;
    tooltipY: number;
  }) | null {
    const activeDate = this.hoveredChartDate ?? this.selectedChartDate;

    if (!activeDate) return null;

    const point = this.chartPoints.find(item => item.date === activeDate);

    if (!point) return null;

    const tooltipWidth = 154;
    const tooltipHeight = 44;
    const margin = 8;
    const viewBoxWidth = 600;
    const viewBoxHeight = 230;

    const tooltipX = Math.max(
      margin,
      Math.min(
        viewBoxWidth - tooltipWidth - margin,
        point.x - tooltipWidth / 2
      )
    );

    const tooltipY = point.y - tooltipHeight - 12 >= margin
      ? point.y - tooltipHeight - 12
      : Math.min(
        viewBoxHeight - tooltipHeight - margin,
        point.y + 14
      );

    return {
      ...point,
      tooltipX,
      tooltipY
    };
  }

  onChartPointEnter(date: string): void {
    this.hoveredChartDate = date;
  }

  onChartPointLeave(): void {
    this.hoveredChartDate = null;
  }

  onChartPointFocus(date: string): void {
    this.hoveredChartDate = date;
  }

  onChartPointBlur(): void {
    this.hoveredChartDate = null;
  }

  selectChartPoint(date: string): void {
    this.selectedChartDate =
      this.selectedChartDate === date ? null : date;

    this.hoveredChartDate = null;
  }

  onChartPointKeydown(event: KeyboardEvent, date: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectChartPoint(date);
    }

    if (event.key === 'Escape') {
      this.selectedChartDate = null;
      this.hoveredChartDate = null;
    }
  }
  editMeasurement(item: BodyMeasurement): void {
    this.editingId = item.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.form.reset({
      measured_on: item.measured_on,
      weight_kg: item.weight_kg,
      body_fat_pct: item.body_fat_pct,
      neck_cm: item.neck_cm,
      shoulders_cm: item.shoulders_cm,
      chest_cm: item.chest_cm,
      arm_relaxed_cm: item.arm_relaxed_cm,
      arm_flexed_cm: item.arm_flexed_cm,
      waist_cm: item.waist_cm,
      hip_cm: item.hip_cm,
      thigh_cm: item.thigh_cm,
      calf_cm: item.calf_cm ?? null,
      notes: item.notes ?? ''
    });

    this.formVisible = true;
  }

  cancelForm(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  saveMeasurement(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage =
        'Revisá los campos marcados. Los valores deben estar dentro de rangos razonables.';
      return;
    }

    const raw = this.form.getRawValue();

    // La fecha determina tanto el registro como el mes al que pertenece.
    const conflict = this.measurements.find(item =>
      item.id !== this.editingId &&
      this.sameWeek(item.measured_on, raw.measured_on)
    );

    if (conflict) {
      this.errorMessage =
        `Ya existe una medición esa semana (${this.formatDate(conflict.measured_on)}). ` +
        'Editá ese registro o elegí otra semana.';
      return;
    }

    const payload: BodyMeasurementWrite = {
      measured_on: raw.measured_on,
      weight_kg: raw.weight_kg,
      body_fat_pct: raw.body_fat_pct,
      neck_cm: raw.neck_cm,
      shoulders_cm: raw.shoulders_cm,
      chest_cm: raw.chest_cm,
      arm_relaxed_cm: raw.arm_relaxed_cm,
      arm_flexed_cm: raw.arm_flexed_cm,
      waist_cm: raw.waist_cm,
      hip_cm: raw.hip_cm,
      thigh_cm: raw.thigh_cm,
      calf_cm: raw.calf_cm,
      notes: raw.notes.trim() || null
    };

    const wasEditing = !!this.editingId;
    this.saving = true;

    const request$ = this.editingId
      ? this.service.updateMeasurement(this.editingId, payload)
      : this.service.createMeasurement(payload);

    request$
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: saved => {
          this.measurements = [
            saved,
            ...this.measurements.filter(row => row.id !== saved.id)
          ].sort((a, b) => b.measured_on.localeCompare(a.measured_on));

          this.compareToId = this.measurements[0]?.id ?? '';
          this.compareFromId = this.measurements[this.measurements.length - 1]?.id ?? '';

          // Si se guarda una fecha de otro mes, mostramos ese mes.
          this.selectedMonth = this.firstDayOfMonth(
            new Date(`${saved.measured_on}T12:00:00`)
          );

          this.formVisible = false;
          this.editingId = null;
          this.successMessage = wasEditing
            ? 'Medición actualizada correctamente.'
            : 'Medición guardada correctamente.';
        },
        error: (error: unknown) => {
          const message = this.readError(error, 'No se pudo guardar la medición.');

          this.errorMessage =
            message.includes('duplicate key') ||
              message.includes('unique constraint') ||
              message.includes('body_measurements_user_id_measured_on_key')
              ? 'Ya existe una medición para esa fecha. Abrila desde el historial para editarla.'
              : message;
        }
      });
  }

  requestDelete(item: BodyMeasurement): void {
    this.showDeleteConfirmId = item.id;
  }

  cancelDelete(): void {
    this.showDeleteConfirmId = null;
  }

  confirmDelete(item: BodyMeasurement): void {
    this.deletingId = item.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.service.deleteMeasurement(item.id)
      .pipe(finalize(() => {
        this.deletingId = null;
        this.showDeleteConfirmId = null;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.measurements = this.measurements.filter(row => row.id !== item.id);

          if (this.compareFromId === item.id) {
            this.compareFromId = this.measurements[this.measurements.length - 1]?.id ?? '';
          }
          if (this.compareToId === item.id) {
            this.compareToId = this.measurements[0]?.id ?? '';
          }

          this.successMessage = 'Medición eliminada.';
        },
        error: (error: unknown) => {
          this.errorMessage = this.readError(error, 'No se pudo eliminar la medición.');
        }
      });
  }

  // ─── Historial mensual ──────────────────────────────────────

  get monthLabel(): string {
    return this.selectedMonth.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric'
    });
  }

  get isCurrentMonth(): boolean {
    const current = this.firstDayOfMonth(new Date());
    return this.dateString(current) === this.dateString(this.selectedMonth);
  }

  get monthlyMeasurements(): BodyMeasurement[] {
    const monthKey = this.dateString(this.selectedMonth).slice(0, 7);
    const query = this.searchText.trim().toLocaleLowerCase('es-AR');

    return this.measurements.filter(item => {
      // El registro pertenece al mes de measured_on, no al de su semana.
      if (item.measured_on.slice(0, 7) !== monthKey) return false;
      if (!query) return true;

      return item.measured_on.includes(query) ||
        (item.notes ?? '').toLocaleLowerCase('es-AR').includes(query);
    });
  }

  previousMonth(): void {
    this.selectedMonth = new Date(
      this.selectedMonth.getFullYear(),
      this.selectedMonth.getMonth() - 1,
      1
    );
  }

  nextMonth(): void {
    this.selectedMonth = new Date(
      this.selectedMonth.getFullYear(),
      this.selectedMonth.getMonth() + 1,
      1
    );
  }

  goToCurrentMonth(): void {
    this.selectedMonth = this.firstDayOfMonth(new Date());
  }

  weekLabel(date: string): string {
    const start = this.startOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return `${this.formatShortDate(this.dateString(start))} – ${this.formatShortDate(this.dateString(end))}`;
  }

  get filteredMeasurements(): BodyMeasurement[] {
    const query = this.searchText.trim().toLocaleLowerCase('es-AR');

    return this.measurements.filter(item =>
      !query ||
      item.measured_on.includes(query) ||
      (item.notes ?? '').toLocaleLowerCase('es-AR').includes(query)
    );
  }

  // ─── Gráfico SVG ────────────────────────────────────────────

  get chartMeasurements(): BodyMeasurement[] {
    let rows = [...this.measurements].sort((a, b) =>
      a.measured_on.localeCompare(b.measured_on)
    );

    if (this.period !== 'all') {
      const months = this.period === '3m' ? 3 : this.period === '6m' ? 6 : 12;
      const cutoff = new Date();
      cutoff.setHours(12, 0, 0, 0);
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffString = this.dateString(cutoff);
      rows = rows.filter(row => row.measured_on >= cutoffString);
    }

    // Solo puntos con un valor real de la métrica elegida.
    return rows.filter(row => this.metricValue(row, this.selectedMetric) !== null);
  }

  get selectedMetricOption(): MeasurementMetricOption {
    return this.metricOptions.find(metric => metric.key === this.selectedMetric)
      ?? this.metricOptions[0];
  }

  get chartPoints(): ChartPoint[] {
    const rows = this.chartMeasurements;

    if (!rows.length) return [];

    const values = rows.map(row =>
      this.metricValue(row, this.selectedMetric)!
    );

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Evita una escala degenerada cuando todos los valores son iguales.
    const padding = max === min
      ? Math.max(Math.abs(max) * 0.04, 1)
      : (max - min) * 0.18;

    const low = min - padding;
    const high = max + padding;

    // Coordenadas coherentes con el viewBox del SVG.
    const plotLeft = 58;
    const plotRight = 572;
    const plotTop = 34;
    const plotBottom = 178;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;
    const valueRange = high - low;

    return rows.map((row, index) => {
      const value = values[index];

      const x = rows.length === 1
        ? (plotLeft + plotRight) / 2
        : plotLeft + (index / (rows.length - 1)) * plotWidth;

      const y = plotBottom -
        ((value - low) / valueRange) * plotHeight;

      return {
        x,
        y,
        value,
        date: row.measured_on,
        label: this.formatShortDate(row.measured_on)
      };
    });
  }
  get chartPolyline(): string {
    return this.chartPoints
      .map(point => `${point.x},${point.y}`)
      .join(' ');
  }

  get chartAreaPath(): string {
    const points = this.chartPoints;

    if (points.length < 2) return '';

    const first = points[0];
    const last = points[points.length - 1];
    const baseline = 178;

    return [
      `M ${first.x},${baseline}`,
      ...points.map(point => `L ${point.x},${point.y}`),
      `L ${last.x},${baseline}`,
      'Z'
    ].join(' ');
  }

  get chartTicks(): ChartTick[] {
    const points = this.chartPoints;

    if (!points.length) return [];

    const values = points.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const padding = max === min
      ? Math.max(Math.abs(max) * 0.04, 1)
      : (max - min) * 0.18;

    const low = min - padding;
    const high = max + padding;

    const plotTop = 34;
    const plotBottom = 178;
    const tickCount = 5;

    return Array.from({ length: tickCount }, (_, index) => {
      const ratio = index / (tickCount - 1);
      const value = high - (high - low) * ratio;
      const y = plotTop + ratio * (plotBottom - plotTop);

      return {
        value,
        y,
        label: value.toLocaleString('es-AR', {
          maximumFractionDigits: 1
        })
      };
    });
  }

  get chartDateLabels(): Array<{ x: number; label: string }> {
    const points = this.chartPoints;

    if (!points.length) return [];

    if (points.length <= 5) {
      return points.map(point => ({
        x: point.x,
        label: point.label
      }));
    }

    const indexes = [...new Set([
      0,
      Math.round((points.length - 1) / 3),
      Math.round((points.length - 1) * 2 / 3),
      points.length - 1
    ])];

    return indexes.map(index => ({
      x: points[index].x,
      label: points[index].label
    }));
  }

  get chartMin(): number | null {
    const values = this.chartPoints.map(point => point.value);
    return values.length ? Math.min(...values) : null;
  }

  get chartMax(): number | null {
    const values = this.chartPoints.map(point => point.value);
    return values.length ? Math.max(...values) : null;
  }

  get firstChartValue(): number | null {
    return this.chartPoints[0]?.value ?? null;
  }

  get lastChartValue(): number | null {
    return this.chartPoints[this.chartPoints.length - 1]?.value ?? null;
  }

  get chartChange(): number | null {
    if (this.firstChartValue === null || this.lastChartValue === null) return null;
    return this.lastChartValue - this.firstChartValue;
  }

  get comparisonFrom(): BodyMeasurement | null {
    return this.measurements.find(item => item.id === this.compareFromId) ?? null;
  }

  get comparisonTo(): BodyMeasurement | null {
    return this.measurements.find(item => item.id === this.compareToId) ?? null;
  }

  get comparisonMetrics(): Array<{
    option: MeasurementMetricOption;
    from: number | null;
    to: number | null;
    difference: number | null;
  }> {
    if (!this.comparisonFrom || !this.comparisonTo) return [];

    return this.metricOptions.map(option => {
      const from = this.metricValue(this.comparisonFrom as BodyMeasurement, option.key);
      const to = this.metricValue(this.comparisonTo as BodyMeasurement, option.key);

      return {
        option,
        from,
        to,
        difference: from !== null && to !== null ? to - from : null
      };
    }).filter(item => item.from !== null || item.to !== null);
  }

  metricValue(item: BodyMeasurement, key: BodyMeasurementMetric): number | null {
    const value = item[key];
    if (value === null || value === undefined) return null;

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  formatValue(value: number | null, unit: string, decimals = 1): string {
    if (value === null || !Number.isFinite(value)) return '—';

    return `${value.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} ${unit}`;
  }

  formatDifference(value: number | null, unit: string): string {
    if (value === null) return 'Sin datos comparables';

    const sign = value > 0 ? '+' : value < 0 ? '−' : '';

    return `${sign}${Math.abs(value).toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })} ${unit}`;
  }

  formatDate(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatShortDate(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short'
    });
  }

  hasAnyMeasurements(item: BodyMeasurement): boolean {
    return this.metricOptions.some(metric =>
      this.metricValue(item, metric.key) !== null
    );
  }

  latestValue(key: BodyMeasurementMetric): number | null {
    const item = this.measurements.find(row => this.metricValue(row, key) !== null);
    return item ? this.metricValue(item, key) : null;
  }

  latestDateFor(key: BodyMeasurementMetric): string | null {
    const item = this.measurements.find(row => this.metricValue(row, key) !== null);
    return item?.measured_on ?? null;
  }

  previousValue(key: BodyMeasurementMetric): number | null {
    const rows = this.measurements.filter(row => this.metricValue(row, key) !== null);
    return rows.length > 1 ? this.metricValue(rows[1], key) : null;
  }

  differenceFromPrevious(key: BodyMeasurementMetric): number | null {
    const current = this.latestValue(key);
    const previous = this.previousValue(key);
    return current !== null && previous !== null ? current - previous : null;
  }

  setPeriod(value: '3m' | '6m' | '1y' | 'all'): void {
    this.period = value;
    this.hoveredChartDate = null;
    this.selectedChartDate = null;
  }

  setMetric(value: string): void {
    if (this.metricOptions.some(option => option.key === value)) {
      this.selectedMetric = value as BodyMeasurementMetric;
      this.hoveredChartDate = null;
      this.selectedChartDate = null;
    }
  }

  private sameWeek(first: string, second: string): boolean {
    return this.dateString(this.startOfWeek(first)) ===
      this.dateString(this.startOfWeek(second));
  }

  /** La semana comienza el lunes y termina el domingo. */
  private startOfWeek(date: string): Date {
    const result = new Date(`${date}T12:00:00`);
    const day = result.getDay();
    result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
    result.setHours(12, 0, 0, 0);
    return result;
  }

  private firstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  }

  private today(): string {
    return this.dateString(new Date());
  }

  private dateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private readError(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      if (error.message === 'unauthorized') {
        return 'Tu sesión expiró. Volvé a iniciar sesión.';
      }
      if (error.message) return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }

    return fallback;
  }


  openMeasurementEducation(metric: string | null = null): void {
    this.educationMetric = metric;
    this.educationVisible = true;
  }

  closeMeasurementEducation(): void {
    this.educationVisible = false;
    this.educationMetric = null;
  }
}
