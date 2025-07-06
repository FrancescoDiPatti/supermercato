import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiConfig } from '../config/api.config';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  email: string;
  role: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface LoginResponse {
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly SESSION_STORAGE_KEY = 'authState';

  private readonly authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null
  });
  
  public readonly isAuthenticated$ = this.authState$.asObservable().pipe(
    map(state => state.isAuthenticated)
  );
  
  public readonly user$ = this.authState$.asObservable().pipe(
    map(state => state.user)
  );
  
  public readonly authState = this.authState$.asObservable();
  
  constructor(private readonly http: HttpClient) {
    this.initializeService();
  }
  
  private initializeService(): void {
    this.loadSessionFromStorage();
    this.setupSessionPersistence();
  }
  
  private loadSessionFromStorage(): void {
    try {
      const savedSession = sessionStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!savedSession) {
        return;
      }
      
      const authState: AuthState = JSON.parse(savedSession);
      if (this.isValidAuthState(authState)) {
        this.authState$.next(authState);
      }
    } catch (error) {
      console.warn('Failed to load session from storage:', error);
      this.clearSessionStorage();
    }
  }
  
  private isValidAuthState(authState: any): authState is AuthState {
    return authState &&
           typeof authState.isAuthenticated === 'boolean' &&
           (authState.user === null || (typeof authState.user === 'object' && authState.user.id));
  }
  
  private setupSessionPersistence(): void {
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

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(ApiConfig.ENDPOINTS.AUTH.LOGIN, credentials).pipe(
      tap((response: LoginResponse) => {
        if (response?.user) {
          this.setAuthenticatedUser(response.user);
        }
      })
    );
  }

  register(data: RegisterData): Observable<any> {
    return this.http.post(ApiConfig.ENDPOINTS.AUTH.REGISTER, data);
  }
  
  logout(): void {
    this.updateAuthState({
      isAuthenticated: false,
      user: null
    });
  }

  setUser(user: User): void {
    this.setAuthenticatedUser(user);
  }
  
  updateUserData(user: User): void {
    const currentState = this.authState$.value;
    if (currentState.isAuthenticated) {
      this.updateAuthState({
        ...currentState,
        user: user
      });
    }
  }
  
  getUser(): User | null {
    return this.authState$.value.user;
  }

  getCurrentAuthState(): AuthState {
    return this.authState$.value;
  }
  
  isLoggedIn(): boolean {
    const currentState = this.authState$.value;
    return currentState.isAuthenticated && currentState.user !== null;
  }
  
  private setAuthenticatedUser(user: User): void {
    this.updateAuthState({
      isAuthenticated: true,
      user: user
    });
  }
  
  private updateAuthState(newState: AuthState): void {
    this.authState$.next(newState);
  }

}
