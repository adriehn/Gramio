export type ErrorCategory = 'AUTH' | 'VALIDATION' | 'CALCULATION' | 'DATABASE' | 'NETWORK' | 'UNKNOWN';

export interface AppError {
  code: string;
  category: ErrorCategory;
  userMessage: string;
  details?: unknown;
}