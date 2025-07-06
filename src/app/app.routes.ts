import { Routes } from '@angular/router';
import { authGuard, adminManagerGuard, customerGuard } from './auth/guards/auth.guard';

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
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./home/dashboard/dashboard.page').then( m => m.DashboardPage)
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
        loadComponent: () => import('./home/carrello/carrello.page').then( m => m.CarrelloPage),
        canActivate: [customerGuard]
      },
      {
        path: 'ordini',
        loadComponent: () => import('./home/ordini/ordini.page').then( m => m.OrdiniPage),
        canActivate: [customerGuard]
      },
      {
        path: 'gestione',
        children: [
          {
            path: 'crea-supermercato',
            loadComponent: () => import('./home/gestione/crea-supermercato/crea-supermercato.page').then( m => m.CreaSupermercatoPage),
            canActivate: [adminManagerGuard]
          },
          {
            path: 'crea-prodotto',
            loadComponent: () => import('./home/gestione/crea-prodotto/crea-prodotto.page').then( m => m.CreaProdottoPage),
            canActivate: [adminManagerGuard]
          },
          {
            path: 'aggiungi-prodotto',
            loadComponent: () => import('./home/gestione/aggiungi-prodotto/aggiungi-prodotto.page').then( m => m.AggiungiProdottoPage)
          }
        ]
      }
    ]
  }
];
