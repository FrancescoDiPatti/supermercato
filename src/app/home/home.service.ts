import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Supermarket {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  active_offers?: number;
  manager_id?: string;
}

export interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  data?: any;
  type: 'search' | 'recent';
  icon?: string;
}

export interface RecentSearch {
  query: string;
  timestamp: number;
  type: string;
  userId: string;
  data?: any;
  resultId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HomeService {
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

  getHome(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/dashboard`, { withCredentials: true });
  }

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

  addSupermarket(supermarket: { name: string; address: string; latitude: string; longitude: string; manager_id?: string; }): Promise<any> {
    return this.http.post(`${this.apiUrl}/add_supermarket`, supermarket).toPromise();
  }

  //Levenshtein distance algorithm to compare strings
  distance(a: string, b: string): number {
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
  }
  isSimilar(query: string, target: string, tolerance: number = 0.4): boolean {
    const distance = this.distance(query.toLowerCase(), target.toLowerCase());
    const maxDistance = Math.ceil(query.length * tolerance);
    return distance <= maxDistance;
  }

  // === GEOGRAPHIC UTILITIES ===
    // Haversine formula for distance calculation
  calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  }

  // Convert degrees to radians
  deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Format meters or kilometers
  formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  }

  // Sord supermarket by distance from user
  sortByDistance(supermarkets: Supermarket[], userLat: number, userLng: number): Supermarket[] {
    return supermarkets.sort((a, b) => {
      const distA = this.calcDistance(userLat, userLng, a.latitude, a.longitude);
      const distB = this.calcDistance(userLat, userLng, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  // Find similar string for logo
  findImageKey(name: string, imageKeys: string[], maxDistance: number = 4): string | null {
    const normalized = name.trim().toLowerCase();
    let minDistance = Infinity;
    let closestKey: string | null = null;
    
    for (const key of imageKeys) {
      const dist = this.distance(normalized, key);
      if (dist < minDistance) {
        minDistance = dist;
        closestKey = key;
      }
    }
    
    return minDistance <= maxDistance ? closestKey : null;
  }

  // Advanced supermarket
  search(
    query: string, 
    supermarkets: Supermarket[], 
    userPosition?: { lat: number; lng: number },
    maxResults: number = 8
  ): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    
    // try exact match
    let filtered = supermarkets.filter(sm => 
      sm.name.toLowerCase().includes(lowerQuery) || 
      sm.address.toLowerCase().includes(lowerQuery)
    );

    // if no exact match, try advanced search
    if (filtered.length === 0 && query.length >= 3) {
      const maxDistance = Math.ceil(query.length * 0.4);
      const tolerantMatches = supermarkets
        .map(sm => ({
          supermarket: sm,
          nameDistance: this.distance(lowerQuery, sm.name.toLowerCase()),
          addressDistance: this.distance(lowerQuery, sm.address.toLowerCase())
        }))
        .filter(item => 
          item.nameDistance <= maxDistance || item.addressDistance <= maxDistance
        )
        .sort((a, b) => {
          const aMinDist = Math.min(a.nameDistance, a.addressDistance);
          const bMinDist = Math.min(b.nameDistance, b.addressDistance);
          return aMinDist - bMinDist;
        })
        
        .slice(0, 5);

      filtered = tolerantMatches.map(item => item.supermarket);
    }
    // Order results
    const sorted = filtered.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(lowerQuery);
      const bNameMatch = b.name.toLowerCase().includes(lowerQuery);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      if (userPosition) {
        const distA = this.calcDistance(userPosition.lat, userPosition.lng, a.latitude, a.longitude);
        const distB = this.calcDistance(userPosition.lat, userPosition.lng, b.latitude, b.longitude);
        return distA - distB;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted.slice(0, maxResults).map(sm => ({
      id: sm.id.toString(),
      label: sm.name,      
      sublabel: `${sm.address}${userPosition ? 
        ' • ' + this.formatDistance(this.calcDistance(userPosition.lat, userPosition.lng, sm.latitude, sm.longitude)) : ''}`,
      data: sm,
      type: 'search' as const
    }));
  }

  // === IMAGE UTILITIES ===
    // Get supermarket image by name match
  getStoreImage(name: string): string {
    const key = this.findImageKey(name, Object.keys(this.supermarketImages), 4);
    return key ? this.supermarketImages[key] : 'assets/supermercati/def_sm.webp';
  }

  // Get supermarket image keys
  getImageKeys(): string[] {
    return Object.keys(this.supermarketImages);
  }


  // === USER ROLE UTILITIES ===

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
}
