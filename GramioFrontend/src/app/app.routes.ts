import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { RegisterComponent } from '@features/auth/register/register';
import { ContactComponent } from './shared/contact/contact';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/home/home').then(m => m.Home),
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./features/metabolic-profile/metabolic-profile').then(m => m.MetabolicProfile)
  },
  {
    path: 'registro',
    component: RegisterComponent
  }, {
    path: 'nutricion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/food-diary/food-diary')
        .then(m => m.FoodDiary)
  },
  {
    path: 'historial-semanal',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/weekly-history/weekly-history')
        .then(m => m.WeeklyHistoryComponent),
  }
  , {
    path: 'progreso-corporal',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/body-measurements/body-measurements')
        .then(m => m.BodyMeasurements)
  }, {
    path: 'tdee-observado',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/observed-tdee/observed-tdee')
        .then(m => m.ObservedTdeeComponent)
  },
  {
    path: 'contacto',
    component: ContactComponent,
  },

  {
    path: '**',
    redirectTo: ''
  }
];
