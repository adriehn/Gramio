import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { RegisterComponent } from '@features/auth/register/register';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/metabolic-profile/metabolic-profile').then(m => m.MetabolicProfile)
  },
  {
    path: 'registro',
    component: RegisterComponent
  }, {
    path: 'nutricion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/nutrition/food-diary/food-diary')
        .then(m => m.FoodDiary)
  },
  {
    path: 'historial-semanal',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/nutrition/weekly-history/weekly-history')
        .then(m => m.WeeklyHistoryComponent),
  }
  ,
  {
    path: '**',
    redirectTo: ''
  }
];
