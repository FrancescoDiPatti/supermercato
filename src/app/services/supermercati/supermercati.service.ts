import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Supermarket {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  active_offers?: number;
  manager_id?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupermercatiService {
  private apiUrl = `${environment.apiUrl}/api`;
  private selectedSupermarketSubject = new BehaviorSubject<Supermarket | null>(null);

  // Supermarket images mapping
  private readonly supermarketImages: { [key: string]: string } = {
    lidl: 'assets/supermercati/lidl.webp',
    conad: 'assets/supermercati/conad.webp',
    crai: 'assets/supermercati/crai.webp',
    md: 'assets/supermercati/md.webp',
    esselunga: 'assets/supermercati/esselunga.webp',
    coop: 'assets/supermercati/coop.webp',
    eurospin: 'assets/supermercati/eurospin.webp',
    carrefour: 'assets/supermercati/carrefour.webp',
    pam: 'assets/supermercati/pam.webp',
    sigma: 'assets/supermercati/sigma.webp',
    "in's": 'assets/supermercati/ins.webp',
    famila: 'assets/supermercati/famila.webp',
    sisa: 'assets/supermercati/sisa.webp',
  };

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

  clearSelectedSupermarket(): void {
    this.selectedSupermarketSubject.next(null);
  }

  selectedSupermarket$ = this.selectedSupermarketSubject.asObservable();

  addSupermarket(supermarket: { name: string; address: string; latitude: string; longitude: string; manager_id?: string; }): Promise<any> {
    return this.http.post(`${this.apiUrl}/add_supermarket`, supermarket).toPromise();
  }

  getManagers(): Observable<User[]> {
    return new Observable(observer => {
      this.http.get(`${environment.apiUrl}/dashboard`, { withCredentials: true }).subscribe({
        next: (data: any) => {
          if (data?.status === 'success' && data?.data?.users) {
            const managers = data.data.users.filter((user: User) => user.role === 'manager');
            observer.next(managers);
            observer.complete();
          } else {
            observer.error('Unable to fetch managers');
          }
        },
        error: (error: any) => observer.error(error)
      });
    });
  }

  // Find similar string for logo
  private findImageKey(name: string, imageKeys: string[], maxDistance: number = 4): string | null {
    const normalized = name.trim().toLowerCase();
    let minDistance = Infinity;
    let closestKey: string | null = null;
    
    // Simple distance calculation for string matching
    const distance = (a: string, b: string): number => {
      const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
      
      for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
      for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
      
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          if (a[i - 1] === b[j - 1]) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + 1
            );
          }
        }
      }
      
      return matrix[a.length][b.length];
    };
    
    for (const key of imageKeys) {
      const dist = distance(normalized, key);
      if (dist < minDistance) {
        minDistance = dist;
        closestKey = key;
      }
    }
    
    return minDistance <= maxDistance ? closestKey : null;
  }
  
  // Get supermarket image by name match
  getStoreImage(name: string): string {
    const brandName = this.extractBrandName(name);
    const key = this.findImageKey(brandName, Object.keys(this.supermarketImages), 4);
    return key ? this.supermarketImages[key] : 'assets/supermercati/def_sm.webp';
  }
  private extractBrandName(name: string): string {
    if (!name) return '';
    const separators = [' - ', ' – ', ' — ', ' (', '('];
    for (const separator of separators) {
      if (name.includes(separator)) {return name.split(separator)[0].trim();}
    }
    return name.trim();
  }

  async getSupermarketsForCurrentUser(): Promise<Supermarket[]> {
    const user = this.getCurrentUser();
    
    if (!user) {
      return [];
    }

    try {
      const response = await this.getSupermarkets().toPromise();
      const supermarkets = response?.supermarkets || [];

      if (user?.role === 'admin') {
        return supermarkets;
      } else if (user?.role === 'manager') {
        return supermarkets.filter(sm => sm.manager_id === user.id);
      } else {
        return supermarkets;
      }
    } catch (error) {
      console.error('Error loading supermarkets:', error);
      return [];
    }
  }

  private getCurrentUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  async loadAndSetupSupermarkets(
    isManager: boolean = false, 
    managerId?: string,
    userPosition?: { lat: number; lng: number }
  ): Promise<Supermarket[]> {
    try {
      let supermarkets = await this.getSupermarketsForCurrentUser();
      if (userPosition) {
        supermarkets = this.sortByDistance(supermarkets, userPosition.lat, userPosition.lng);
      }
      
      return supermarkets;
    } catch (error) {
      console.error('Error loading supermarkets:', error);
      return [];
    }
  }

  private sortByDistance(supermarkets: Supermarket[], userLat: number, userLng: number): Supermarket[] {
    const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = this.deg2rad(lat2 - lat1);
      const dLon = this.deg2rad(lon2 - lon1);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      return R * c;
    };

    return supermarkets.sort((a, b) => {
      const distA = calcDistance(userLat, userLng, a.latitude, a.longitude);
      const distB = calcDistance(userLat, userLng, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}
