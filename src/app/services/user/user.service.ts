import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private authService = inject(AuthService);

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
    return this.authService.getUser();
  }

  getCurrentUser$(): Observable<any> {
    return this.authService.user$;
  }

  isUserAdmin(): boolean {
    const user = this.getCurrentUser();
    return UserService.isAdmin(user);
  }

  isUserAdmin$(): Observable<boolean> {
    return this.authService.user$.pipe(
      map(user => UserService.isAdmin(user))
    );
  }

  isUserManager(): boolean {
    const user = this.getCurrentUser();
    return UserService.isManager(user);
  }

  isUserManager$(): Observable<boolean> {
    return this.authService.user$.pipe(
      map(user => UserService.isManager(user))
    );
  }

  isUserAdminOrManager(): boolean {
    const user = this.getCurrentUser();
    return UserService.isAdminOrManager(user);
  }

  isUserAdminOrManager$(): Observable<boolean> {
    return this.authService.user$.pipe(
      map(user => UserService.isAdminOrManager(user))
    );
  }

  canCreateSupermarket(): boolean {
    return this.isUserAdminOrManager();
  }

  canCreateSupermarket$(): Observable<boolean> {
    return this.isUserAdminOrManager$();
  }
}
