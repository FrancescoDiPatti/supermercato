import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, timer } from 'rxjs';
import { catchError, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ApiConfig } from '../config/api.config';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  sessionExpiry: number | null; // null = no expiry
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrls = ApiConfig.getAllApiUrls();
  private currentApiUrl: string = ApiConfig.getPrimaryApiUrl();
  private readonly SESSION_STORAGE_KEY = 'authState';
  
  // BehaviorSubject for managing authentication state
  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    sessionExpiry: null
  });
  
  // Public observables
  public readonly isAuthenticated$ = this.authState$.asObservable().pipe(
    tap(state => state.isAuthenticated),
    switchMap(state => [state.isAuthenticated])
  );
  
  public readonly user$ = this.authState$.asObservable().pipe(
    tap(state => state.user),
    switchMap(state => [state.user])
  );
    public readonly authState = this.authState$.asObservable();
  
  constructor(private http: HttpClient) {
    this.loadSessionFromStorage();
    this.setupSessionPersistence();
  }
  
  private loadSessionFromStorage(): void {
    try {
      const savedSession = sessionStorage.getItem(this.SESSION_STORAGE_KEY);
      if (savedSession) {
        const authState: AuthState = JSON.parse(savedSession);
        // Verify that the saved session is still valid structure
        if (authState && typeof authState.isAuthenticated === 'boolean' && authState.user) {
          this.authState$.next(authState);
        }
      }
    } catch (error) {
      console.warn('Failed to load session from storage:', error);
      this.clearSessionStorage();
    }
  }
  
  private setupSessionPersistence(): void {
    // Save session state to sessionStorage whenever it changes
    this.authState$.subscribe(authState => {
      if (authState.isAuthenticated && authState.user) {
        this.saveSessionToStorage(authState);
      } else {
        this.clearSessionStorage();
      }
    });
  }
  
  private saveSessionToStorage(authState: AuthState): void {
    try {
      sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(authState));
    } catch (error) {
      console.warn('Failed to save session to storage:', error);
    }
  }
  
  private clearSessionStorage(): void {
    sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
  }
  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post(ApiConfig.ENDPOINTS.AUTH.LOGIN, credentials).pipe(
      catchError(() => {
        // Se fallisce, prova con localhost
        return this.http.post(ApiConfig.ENDPOINTS.AUTH.LOGIN_URLS[1], credentials);
      }),
      tap((response: any) => {
        if (response && response.user) {
          this.setAuthenticatedUser(response.user);
        }
      })
    );
  }

  register(data: { username: string; password: string; email: string; role: string }): Observable<any> {
    return this.http.post(ApiConfig.ENDPOINTS.AUTH.REGISTER, data).pipe(
      catchError(() => {
        // Se fallisce, prova con localhost
        return this.http.post(ApiConfig.ENDPOINTS.AUTH.REGISTER_URLS[1], data);
      })
    );
  }  private setAuthenticatedUser(user: User): void {
    this.authState$.next({
      isAuthenticated: true,
      user: user,
      sessionExpiry: null // null = infinite session, managed by sessionStorage
    });
  }

  setUser(user: User): void {
    this.setAuthenticatedUser(user);
  }  updateUserData(user: User): void {
    const currentState = this.authState$.value;
    if (currentState.isAuthenticated) {
      this.authState$.next({
        ...currentState,
        user: user
      });
    }
  }

  getUser(): User | null {
    return this.authState$.value.user;
  }

  isLoggedIn(): boolean {
    const currentState = this.authState$.value;
    return currentState.isAuthenticated && currentState.user !== null;
  }  logout(): void {
    this.authState$.next({
      isAuthenticated: false,
      user: null,
      sessionExpiry: null
    });
  }

  // Compatibility method - kept for backward compatibility
  clearHomeData(): void {
    // This method does nothing in the new sessionStorage-based system
    // Data is automatically cleared on logout via setupSessionPersistence()
  }

  // Helper methods for session management
  getSessionTimeRemaining(): number {
    // SessionStorage-based session - returns -1 to indicate persistence until tab closure
    return -1;
  }

  isSessionExpiring(): boolean {
    // SessionStorage-based session - never expires until tab closure
    return false;
  }
}
