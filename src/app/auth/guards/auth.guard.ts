import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (!isAuthenticated) {
        router.navigate(['/login']);
        return false;
      }
      return true;
    })
  );
};

export const adminManagerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authState.pipe(
    take(1),
    map(authState => {
      if (!authState.isAuthenticated) {
        router.navigate(['/login']);
        return false;
      }

      const user = authState.user;
      if (user && (user.role === 'admin' || user.role === 'manager')) {
        return true;
      } else {
        router.navigate(['/home/dashboard']);
        return false;
      }
    })
  );
};
