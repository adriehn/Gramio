import { NutritionApiService } from '../../core/services/nutrition-api.service';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { EMPTY, catchError, debounceTime, filter, of, switchMap, tap, timer } from 'rxjs';
import { ProfileService } from '../../core/services/profile.service';
import { MetabolicInput, Sex, BmrFormula, GoalType, FatMode, FiberMode, CalculatedTarget, ProteinMode } from '../../core/models/nutrition.model';
import { EDUCATION_CONTENT, EducationTopic } from './metabolic-profile-education';

@Component({
  selector: 'app-metabolic-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './metabolic-profile.html',
  styleUrl: './metabolic-profile.css'
})
export class MetabolicProfile implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nutritionApi = inject(NutritionApiService);

  @ViewChild('modalDialog')
  private modalDialog?: ElementRef<HTMLElement>;

  @ViewChild('modalCloseButton')
  private modalCloseButton?: ElementRef<HTMLButtonElement>;

  private lastFocusedElement: HTMLElement | null = null;
  //Señales de entrada del usuario
  readonly sex = signal<Sex>('male');
  readonly age = signal<number>(0);
  readonly weightKg = signal<number>(0);
  readonly heightCm = signal<number>(0);
  readonly bodyFatPct = signal<number | undefined>(undefined);
  //señales de proteínass
  readonly proteinMode = signal<ProteinMode>('per_kg');
  readonly proteinValue = signal<number>(1.8);
  //Señal de actividad
  readonly activityFactor = signal<number>(1.2);
  readonly formula = signal<BmrFormula>('mifflin');
  //Señal de objetivo
  readonly goalType = signal<GoalType>('deficit');
  readonly kcalAdjustment = signal<number>(-300);
  //Señal de grasas
  readonly fatMode = signal<FatMode>('per_kg');
  readonly fatValue = signal<number>(0.8);
  //Señal de fibra
  readonly fiberMode = signal<FiberMode>('per_1000kcal');
  readonly fiberValue = signal<number>(14);

  readonly saveSuccess = signal(false);
  readonly activeModal = signal<EducationTopic | null>(null);

  readonly educationContent = EDUCATION_CONTENT;

  readonly isLoading = this.profileService.isLoading;
  readonly activeTarget = this.profileService.activeTarget;
  readonly serviceError = this.profileService.error;

  private saving = false;

  readonly currentInput = computed<MetabolicInput>(() => ({
    sex: this.sex(),
    age: this.age(),
    weightKg: this.weightKg(),
    heightCm: this.heightCm(),
    bodyFatPct: this.bodyFatPct(),
    activityFactor: this.activityFactor(),
    formula: this.formula(),
    goalType: this.goalType(),
    kcalAdjustment: this.kcalAdjustment(),
    proteinMode: this.proteinMode(),
    proteinValue: this.proteinValue(),
    // Compatibilidad por si el BFF / API todavía espera esta propiedad exacta:
    proteinRatioPerKg: this.proteinMode() === 'per_kg' ? this.proteinValue() : (this.proteinValue() * this.weightKg() / 100),
    fatMode: this.fatMode(),
    fatValue: this.fatValue(),
    fiberMode: this.fiberMode(),
    fiberValue: this.fiberValue()
  }));

  /**
   * Vista previa asíncrona consumiendo el BFF
   */
  readonly preview = toSignal<CalculatedTarget | null>(
    toObservable(this.currentInput).pipe(
      debounceTime(400),
      filter(input => this.isValidInput(input)),
      switchMap(input => this.nutritionApi.calculateTarget(input).pipe(
        catchError(() => of(null))
      ))
    ),
    { initialValue: null }
  );

  private isValidInput(input: MetabolicInput): boolean {
    const validAnthropometry =
      Number.isFinite(input.age) && input.age >= 1 && input.age <= 120 &&
      Number.isFinite(input.weightKg) && input.weightKg > 0 && input.weightKg <= 500 &&
      Number.isFinite(input.heightCm) && input.heightCm >= 50 && input.heightCm <= 260;

    const validActivity = Number.isFinite(input.activityFactor) && input.activityFactor > 0;
    const validAdjustment = Number.isFinite(input.kcalAdjustment);
    const validProtein = Number.isFinite(input.proteinValue) && input.proteinValue > 0;
    const validFat = Number.isFinite(input.fatValue) && input.fatValue > 0;
    const validFiber = Number.isFinite(input.fiberValue) && input.fiberValue > 0;

    const validBodyFat = input.formula !== 'katch' ||
      (input.bodyFatPct !== undefined && Number.isFinite(input.bodyFatPct) &&
        input.bodyFatPct >= 1 && input.bodyFatPct <= 75);

    return Boolean(
      validAnthropometry && validActivity && validAdjustment &&
      validProtein && validFat && validFiber && validBodyFat
    );
  }


  ngOnInit(): void {
    forkJoin({
      profile: this.profileService.loadUserProfile(),
      target: this.profileService.loadActiveTarget()
    }).pipe(
      tap(({ profile }) => {
        if (!profile) return;

        this.sex.set(profile.sex);
        this.heightCm.set(profile.heightCm);

        const birthDate = new Date(`${profile.birthDate}T00:00:00`);

        if (Number.isNaN(birthDate.getTime())) return;

        const today = new Date();
        let calculatedAge =
          today.getFullYear() - birthDate.getFullYear();

        const birthdayHasNotOccurred =
          today.getMonth() < birthDate.getMonth() ||
          (
            today.getMonth() === birthDate.getMonth() &&
            today.getDate() < birthDate.getDate()
          );

        if (birthdayHasNotOccurred) {
          calculatedAge--;
        }

        if (calculatedAge >= 0 && calculatedAge <= 120) {
          this.age.set(calculatedAge);
        }
      }),
      tap(() => this.applyActiveTarget()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }


  private applyActiveTarget(): void {
    const current = this.activeTarget() as any; // Cast temporal a any si el tipado global aún no se actualizó
    if (!current) return;

    this.weightKg.set(current.weight_kg);
    this.age.set(current.age_years);
    this.activityFactor.set(current.activity_factor);
    this.formula.set(current.bmr_formula);
    this.goalType.set(current.goal_type);
    this.kcalAdjustment.set(current.kcal_adjustment);

    // Mapeo seguro de proteínas soportando ambos formatos
    this.proteinMode.set(current.protein_mode ?? 'per_kg');
    this.proteinValue.set(current.protein_value ?? current.protein_per_kg ?? 0);

    this.fatMode.set(current.fat_mode);
    this.fatValue.set(current.fat_value);
    this.fiberMode.set(current.fiber_mode);
    this.fiberValue.set(current.fiber_value);
    this.bodyFatPct.set(current.body_fat_pct ?? undefined);
  }

  openModal(topic: EducationTopic, event: Event): void {
    this.lastFocusedElement = event.currentTarget as HTMLElement;
    this.activeModal.set(topic);
    this.focusModalCloseButton();
  }

  private focusModalCloseButton(): void {
    if (!this.activeModal()) return;

    timer(0).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.modalCloseButton?.nativeElement.focus();
    });
  }

  closeModal(): void {
    this.activeModal.set(null);

    timer(0).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.lastFocusedElement?.focus();
      this.lastFocusedElement = null;
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleDocumentKeydown(event: KeyboardEvent): void {
    if (!this.activeModal()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeModal();
      return;
    }

    if (event.key !== 'Tab' || !this.modalDialog) return;

    const focusable = Array.from(
      this.modalDialog.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(element => element.offsetParent !== null);

    if (focusable.length === 0) {
      event.preventDefault();
      this.modalDialog.nativeElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && (document.activeElement === first || !this.modalDialog.nativeElement.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !this.modalDialog.nativeElement.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  setGoalType(value: GoalType): void {
    this.goalType.set(value);
    const adjustment = Math.abs(this.kcalAdjustment());

    if (value === 'deficit') {
      this.kcalAdjustment.set(-(adjustment || 300));
    } else if (value === 'surplus') {
      this.kcalAdjustment.set(adjustment || 200);
    } else {
      this.kcalAdjustment.set(0);
    }
  }

  onKcalAdjustmentChange(value: number): void {
    if (!Number.isFinite(value)) return;
    this.kcalAdjustment.set(value);
  }

  save(): void {
    const result = this.preview();

    if (!result || this.isLoading() || this.saving) {
      return;
    }

    this.saving = true;
    this.saveSuccess.set(false);

    this.profileService.saveUserProfile(
      this.sex(),
      this.heightCm()
    ).pipe(
      switchMap(profileSaved => {
        if (!profileSaved) return EMPTY;

        return this.profileService.saveTarget({
          is_active: true,
          weight_kg: this.weightKg(),
          body_fat_pct: this.bodyFatPct() ?? null,
          age_years: this.age(),
          activity_factor: this.activityFactor(),
          bmr_formula: this.formula(),
          goal_type: this.goalType(),
          kcal_adjustment: this.kcalAdjustment(),

          // Compatibilidad con el esquema actual de Supabase.
          protein_per_kg: this.proteinMode() === 'per_kg'
            ? this.proteinValue()
            : (this.proteinValue() * 4 / this.preview()!.targetKcal) * 100,

          fat_mode: this.fatMode(),
          fat_value: this.fatValue(),
          fiber_mode: this.fiberMode(),
          fiber_value: this.fiberValue(),

          bmr_kcal: result.bmr,
          tdee_kcal: result.tdee,
          target_kcal: result.targetKcal,
          protein_g: result.proteinG,
          fat_g: result.fatG,
          carbs_g: result.carbsG,
          fiber_g: result.fiberG
        });
      }),
      tap(saved => {
        if (saved) {
          this.saveSuccess.set(true);
        }
      }),
      switchMap(saved => {
        if (!saved) return EMPTY;

        return timer(3000).pipe(
          tap(() => this.saveSuccess.set(false))
        );
      }),
      catchError((error: unknown) => {
        console.error('Error al guardar el objetivo metabólico:', error);
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}