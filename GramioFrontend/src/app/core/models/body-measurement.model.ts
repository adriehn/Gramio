export interface BodyMeasurement {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  neck_cm: number | null;
  shoulders_cm: number | null;
  chest_cm: number | null;
  arm_relaxed_cm: number | null;
  arm_flexed_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  notes: string | null;
  created_at: string;
}

export type BodyMeasurementWrite = Omit<
  BodyMeasurement,
  'id' | 'user_id' | 'created_at'
>;

export type BodyMeasurementMetric =
  | 'weight_kg'
  | 'body_fat_pct'
  | 'neck_cm'
  | 'shoulders_cm'
  | 'chest_cm'
  | 'arm_relaxed_cm'
  | 'arm_flexed_cm'
  | 'waist_cm'
  | 'hip_cm'
  | 'thigh_cm'
  | 'calf_cm';

export interface MeasurementMetricOption {
  key: BodyMeasurementMetric;
  label: string;
  shortLabel: string;
  unit: 'kg' | '%' | 'cm';
}
export interface ChartPoint {
  x: number;
  y: number;
  label: string;
  date: string;
  value: number;
}

export interface ChartTick {
  value: number;
  y: number;
  label: string;
}