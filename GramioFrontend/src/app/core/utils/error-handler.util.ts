import { AppError } from '../models/app-error.model';

const ERROR_DICTIONARY: Record<string, string> = {
  'invalid_credentials': 'El correo electrónico o la contraseña son incorrectos.',
  'user_not_found': 'No existe una cuenta registrada con ese correo electrónico.',
  'user_already_exists': 'Ya existe una cuenta registrada con este correo electrónico.',
  'weak_password': 'La contraseña debe contener al menos 6 caracteres.',
  'over_email_send_rate_limit': 'Demasiados intentos en poco tiempo. Esperá unos minutos antes de reintentar.',
  'network_failure': 'No se pudo conectar con el servidor. Revisá tu conexión a internet.',
  'day_already_closed': 'El día ya fue consolidado y cerrado. Reabrilo para registrar nuevos pesajes.',
  'missing_body_fat': 'Para la fórmula Katch-McArdle es obligatorio indicar el porcentaje de grasa corporal.',
  'negative_carbs': 'La asignación de proteínas y grasas supera las calorías totales del objetivo.',
  'unauthorized': 'Tu sesión expiró o no tenés permisos para realizar esta operación.'
};

export function normalizeAppError(error: unknown, fallbackMessage = 'Ocurrió un error inesperado al procesar la solicitud.'): AppError {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      category: 'UNKNOWN',
      userMessage: fallbackMessage
    };
  }

  // Errores provenientes de Supabase Auth / PostgREST
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const err = error as { message?: string; code?: string; status?: number };
    const rawMsg = err.message?.toLowerCase() || '';

    if (rawMsg.includes('invalid login credentials') || rawMsg.includes('invalid_grant')) {
      return { code: 'INVALID_CREDENTIALS', category: 'AUTH', userMessage: ERROR_DICTIONARY['invalid_credentials']! };
    }
    if (rawMsg.includes('user already registered')) {
      return { code: 'USER_ALREADY_EXISTS', category: 'AUTH', userMessage: ERROR_DICTIONARY['user_already_exists']! };
    }
    if (rawMsg.includes('password should be at least')) {
      return { code: 'WEAK_PASSWORD', category: 'VALIDATION', userMessage: ERROR_DICTIONARY['weak_password']! };
    }
    if (rawMsg.includes('rate limit')) {
      return { code: 'RATE_LIMIT', category: 'AUTH', userMessage: ERROR_DICTIONARY['over_email_send_rate_limit']! };
    }
    if (rawMsg.includes('failed to fetch')) {
      return { code: 'NETWORK_ERROR', category: 'NETWORK', userMessage: ERROR_DICTIONARY['network_failure']! };
    }
    if (rawMsg.includes('está cerrado')) {
      return { code: 'DAY_CLOSED', category: 'DATABASE', userMessage: ERROR_DICTIONARY['day_already_closed']! };
    }
  }

  // Errores controlados con mensaje de texto manual
  if (typeof error === 'string') {
    const translation = ERROR_DICTIONARY[error];
    if (translation) {
      return { code: error.toUpperCase(), category: 'VALIDATION', userMessage: translation };
    }
  }

  return {
    code: 'GENERAL_ERROR',
    category: 'UNKNOWN',
    userMessage: fallbackMessage,
    details: error
  };
}