import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor() { }

  // === USER ROLE ===

  static isAdmin(user: any): boolean {
    return user?.role === 'admin';
  }

  static isManager(user: any): boolean {
    return user?.role === 'manager';
  }

  static isCustomer(user: any): boolean {
    return user?.role === 'customer';
  }

  static isAdminOrManager(user: any): boolean {
    return user?.role === 'admin' || user?.role === 'manager';
  }

  // === USER MANAGEMENT ===
  
  getCurrentUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isUserAdmin(): boolean {
    const user = this.getCurrentUser();
    return UserService.isAdmin(user);
  }

  isUserManager(): boolean {
    const user = this.getCurrentUser();
    return UserService.isManager(user);
  }

  isUserAdminOrManager(): boolean {
    const user = this.getCurrentUser();
    return UserService.isAdminOrManager(user);
  }

  canCreateSupermarket(): boolean {
    return this.isUserAdminOrManager();
  }
}
