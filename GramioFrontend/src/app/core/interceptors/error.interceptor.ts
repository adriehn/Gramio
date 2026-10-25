import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Ocurrió un error inesperado en el servidor.';

      if (error.error && typeof error.error === 'object' && 'message' in error.error) {
        errorMessage = (error.error as { message: string }).message;
      } else if (error.status === 0) {
        errorMessage = 'No se pudo conectar con el servidor. Verifique su conexión.';
      } else if (error.status === 401) {
        errorMessage = 'Sesión expirada o no autorizada. Por favor inicie sesión nuevamente.';
      } else if (error.status === 403) {
        errorMessage = 'No cuenta con los permisos necesarios para realizar esta acción.';
      }

      notificationService.show(errorMessage, 'error');
      return throwError(() => error);
    })
  );
};