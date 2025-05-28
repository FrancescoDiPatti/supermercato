import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
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
    path: 'list',
    loadComponent: () => import('./supermercati/list/list.page').then( m => m.ListPage)
  },
  {
    path: 'detail',
    loadComponent: () => import('./supermercati/detail/detail.page').then( m => m.DetailPage)
  },
  {
    path: 'create',
    loadComponent: () => import('./supermercati/create/create.page').then( m => m.CreatePage)
  },
  {
    path: 'list',
    loadComponent: () => import('./prodotti/list/list.page').then( m => m.ListPage)
  },
  {
    path: 'create',
    loadComponent: () => import('./prodotti/create/create.page').then( m => m.CreatePage)
  },
  {
    path: 'offerte',
    loadComponent: () => import('./prodotti/offerte/offerte.page').then( m => m.OffertePage)
  },
  {
    path: 'list',
    loadComponent: () => import('./acquisti/list/list.page').then( m => m.ListPage)
  },
  {
    path: 'create',
    loadComponent: () => import('./acquisti/create/create.page').then( m => m.CreatePage)
  },
  {
    path: 'user',
    loadComponent: () => import('./dashboard/user/user.page').then( m => m.UserPage)
  },
  {
    path: 'admin',
    loadComponent: () => import('./dashboard/admin/admin.page').then( m => m.AdminPage)
  },
];
