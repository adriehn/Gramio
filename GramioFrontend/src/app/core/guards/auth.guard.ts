import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Espera a que Supabase termine de recuperar la sesión inicial.
  return toObservable(auth.isLoading).pipe(
    filter((isLoading) => !isLoading),
    take(1),
    map(() => {
      if (auth.isAuthenticated()) {
        return true;
      }

      return router.createUrlTree(['/login']);
    })
  );
};