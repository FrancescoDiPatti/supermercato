import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isLoggedIn()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then( m => m.HomePage),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./home/dashboard/dashboard.page').then( m => m.DashboardPage)
      },
      {
        path: 'supermercati',
        loadComponent: () => import('./home/supermercati/supermercati.page').then( m => m.SupermercatiPage)
      },
      {
        path: 'prodotti',
        loadComponent: () => import('./home/prodotti/prodotti.page').then( m => m.ProdottiPage)
      },
      {
        path: 'offerte',
        loadComponent: () => import('./home/offerte/offerte.page').then( m => m.OffertePage)
      },
      {
        path: 'carrello',
        loadComponent: () => import('./home/carrello/carrello.page').then( m => m.CarrelloPage)
      },
      {
        path: 'ordini',
        loadComponent: () => import('./home/ordini/ordini.page').then( m => m.OrdiniPage)
      }
    ]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./home/dashboard/dashboard.page').then( m => m.DashboardPage)
  }
];
