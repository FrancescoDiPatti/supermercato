import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) { }

  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  register(data: { username: string; password: string; email: string; role: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  setUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('homeData');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('user');
  }

  clearHomeData() {
    localStorage.removeItem('homeData');
  }
}
