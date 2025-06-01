import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HomeService {
  private apiUrl = 'http://localhost:5000/dashboard';

  constructor(private http: HttpClient) { }

  getHome(): Observable<any> {
    return this.http.get(this.apiUrl, { withCredentials: true });
  }
}
