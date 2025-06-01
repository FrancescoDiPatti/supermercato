import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Supermarket {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  active_offers?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SupermercatiService {
  private apiUrl = `${environment.apiUrl}/api`;
  private selectedSupermarketSubject = new BehaviorSubject<Supermarket | null>(null);

  constructor(private http: HttpClient) { }

  getSupermarkets(): Observable<{ supermarkets: Supermarket[] }> {
    return this.http.get<{ supermarkets: Supermarket[] }>(`${this.apiUrl}/supermarkets`);
  }

  getSupermarketDetails(id: number): Observable<{ supermarket: Supermarket }> {
    return this.http.get<{ supermarket: Supermarket }>(`${this.apiUrl}/supermarkets/${id}`);
  }

  setSelectedSupermarket(supermarket: Supermarket): void {
    this.selectedSupermarketSubject.next(supermarket);
  }

  getSelectedSupermarket(): Supermarket | null {
    return this.selectedSupermarketSubject.value;
  }

  selectedSupermarket$ = this.selectedSupermarketSubject.asObservable();

  addSupermarket(supermarket: { name: string; address: string; latitude: string; longitude: string }): Promise<any> {
    return this.http.post(`${this.apiUrl}/add_supermarket`, supermarket).toPromise();
  }
}
