import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api';
  private readonly AUTH_TOKEN_KEY = 'authToken';
  private readonly USER_KEY = 'user';
  private readonly HOME_DATA_KEY = 'homeData';
  // 10 ore
  private readonly DEFAULT_SESSION_DURATION = 10 * 60 * 60 * 1000;
  // 5 minuti
  private readonly EXTENSION_THRESHOLD = 5 * 60 * 1000;

  constructor(private http: HttpClient) { }
  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  register(data: { username: string; password: string; email: string; role: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  setUser(user: any) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.setAuthToken();    const event = new CustomEvent('userChanged', { 
      detail: { action: 'login', user } 
    });
    window.dispatchEvent(event);
  }

  updateUserData(user: any) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    if (this.isAuthenticationValid()) {
      this.extendSession();
    }
  }

  private setAuthToken() {
    const token = this.generateAuthToken();
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
  }

  private generateAuthToken(): string {
    const timestamp = Date.now();
    const randomValue = Math.random().toString(36).substring(2);
    const tokenData = {
      created: timestamp,
      random: randomValue,
      maxDuration: this.DEFAULT_SESSION_DURATION,
      extensions: 0
    };
    return btoa(JSON.stringify(tokenData));
  }
  private getTokenData(token: string): { created: number; random: string; maxDuration: number; extensions: number } | null {
    try {
      const decodedToken = atob(token);
      return JSON.parse(decodedToken);
    } catch (error) {
      return null;
    }
  }

  private updateTokenTimestamp(): void {
    const token = localStorage.getItem(this.AUTH_TOKEN_KEY);
    if (!token) return;

    const tokenData = this.getTokenData(token);
    if (!tokenData) return;

    tokenData.maxDuration += this.EXTENSION_THRESHOLD;
    tokenData.extensions += 1;
    
    const updatedToken = btoa(JSON.stringify(tokenData));
    localStorage.setItem(this.AUTH_TOKEN_KEY, updatedToken);
  }
  
  getUser() {
    if (!this.isAuthenticationValid()) {
      return null;
    }
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  private extendSession() {
    this.updateTokenTimestamp();
  }

  private isAuthenticationValid(): boolean {
    const token = localStorage.getItem(this.AUTH_TOKEN_KEY);
    
    if (!token) {
      return false;
    }
    
    const tokenData = this.getTokenData(token);
    if (!tokenData) {
      return false;
    }
    
    const currentTime = Date.now();
    const tokenAge = currentTime - tokenData.created;
    const maxAllowedDuration = tokenData.maxDuration;
    const timeRemaining = maxAllowedDuration - tokenAge;
    
    // estende sessione se sta scadendo il tempo
    if (timeRemaining <= this.EXTENSION_THRESHOLD && timeRemaining > 0) {
      this.extendSession();
      return true;
    }
    
    return tokenAge < maxAllowedDuration;
  }

  logout() {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.HOME_DATA_KEY);
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    const event = new CustomEvent('userChanged', { 
      detail: { action: 'logout', user: null }
    });
    window.dispatchEvent(event);
  }
    isLoggedIn(): boolean {
    return this.isAuthenticationValid() && !!localStorage.getItem(this.USER_KEY);
  }

  clearHomeData() {
    localStorage.removeItem(this.HOME_DATA_KEY);
  }
}
