export class NutritionService {
  static calculateBmr(input) {
    const { sex, age, weightKg: w, heightCm: h, bodyFatPct, formula } = input;

    switch (formula) {
      case 'mifflin':
        return Math.round(10 * w + 6.25 * h - 5 * age + (sex === 'male' ? 5 : -161));
      case 'harris':
        return Math.round(
          sex === 'male'
            ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age
            : 447.593 + 9.247 * w + 3.098 * h - 4.33 * age
        );
      case 'katch':
        if (bodyFatPct === undefined || bodyFatPct === null) {
          throw new Error('missing_body_fat');
        }
        const leanMass = w * (1 - bodyFatPct / 100);
        return Math.round(370 + 21.6 * leanMass);
      default:
        throw new Error('Fórmula BMR inválida');
    }
  }

  static computeTargetSplit(input) {
    const bmr = this.calculateBmr(input);
    const tdee = Math.round(bmr * input.activityFactor);
    const targetKcal = Math.max(1000, tdee + input.kcalAdjustment);

    const proteinG = Math.round(input.weightKg * input.proteinRatioPerKg * 10) / 10;
    const proteinKcal = proteinG * 4;

    let fatG = 0;
    if (input.fatMode === 'per_kg') {
      fatG = input.weightKg * input.fatValue;
    } else if (input.fatMode === 'pct_kcal') {
      fatG = (targetKcal * (input.fatValue / 100)) / 9;
    } else {
      fatG = input.fatValue;
    }
    fatG = Math.round(fatG * 10) / 10;
    const fatKcal = fatG * 9;

    const remainingKcal = targetKcal - (proteinKcal + fatKcal);
    if (remainingKcal < 0) {
      throw new Error('negative_carbs');
    }

    const carbsG = Math.round((remainingKcal / 4) * 10) / 10;

    let fiberG = 0;
    if (input.fiberMode === 'per_1000kcal') {
      fiberG = Math.round((targetKcal / 1000) * input.fiberValue * 10) / 10;
    } else {
      fiberG = input.fiberValue;
    }

    return { bmr, tdee, targetKcal, proteinG, fatG, carbsG, fiberG };
  }
}