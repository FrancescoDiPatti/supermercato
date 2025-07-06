import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiConfig } from '../../config/api.config';
import { AuthService } from '../../auth/auth.service';
import { PosizioneService } from '../posizione/posizione.service';

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
  // Constants
  private readonly SELECTED_SUPERMARKET_KEY = 'selected_supermarket';

  // Subjects
  private selectedSupermarketSubject = new BehaviorSubject<Supermarket | null>(null);
  selectedSupermarket$ = this.selectedSupermarketSubject.asObservable();

  // Images
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

  constructor(private http: HttpClient, private authService: AuthService, private posizioneService: PosizioneService) {
    this.loadSelectedSupermarket();
  }

  // API METHODS

  // Get list of supermarkets
  getSupermarkets(): Observable<{ supermarkets: Supermarket[] }> {
    return this.http.get<{ supermarkets: Supermarket[] }>(ApiConfig.ENDPOINTS.SUPERMARKETS.LIST);
  }

  // Adds new supermarket
  addSupermarket(supermarket: { name: string; address: string; latitude: string; longitude: string; manager_id?: string }): Promise<any> {
    return this.http.post(ApiConfig.ENDPOINTS.SUPERMARKETS.ADD, supermarket).toPromise();
  }

  // SUPERMARKET SELECTION

  // Store selected supermarket in session storage
  setSelectedSupermarket(supermarket: Supermarket | null): void {
    if (supermarket) {
      sessionStorage.setItem(this.SELECTED_SUPERMARKET_KEY, JSON.stringify(supermarket));
    } else {
      sessionStorage.removeItem(this.SELECTED_SUPERMARKET_KEY);
    }
    this.selectedSupermarketSubject.next(supermarket);
  }

  // Get selected supermarket
  getSelectedSupermarket(): Supermarket | null {
    return this.selectedSupermarketSubject.value;
  }

  // Clear selected supermarket from session storage
  clearSelectedSupermarket(): void {
    sessionStorage.removeItem(this.SELECTED_SUPERMARKET_KEY);
    this.selectedSupermarketSubject.next(null);
  }

  // Load selected supermarket from session storage
  private loadSelectedSupermarket(): void {
    try {
      const supermarketStr = sessionStorage.getItem(this.SELECTED_SUPERMARKET_KEY);
      if (supermarketStr) {
        const supermarket = JSON.parse(supermarketStr) as Supermarket;
        this.selectedSupermarketSubject.next(supermarket);
      }
    } catch (error) {
      console.error('Error loading selected supermarket from session storage:', error);
      sessionStorage.removeItem(this.SELECTED_SUPERMARKET_KEY);
      this.selectedSupermarketSubject.next(null);
    }
  }

  // MANAGER LIST

  // Get list of managers
  getManagers(): Observable<User[]> {
    return new Observable(observer => {
      this.http.get(ApiConfig.ENDPOINTS.DASHBOARD, { withCredentials: true }).subscribe({
        next: (data: any) => {
          if (data?.status === 'success' && data?.data?.users) {
            const managers = data.data.users.filter((user: User) => user.role === 'manager');
            observer.next(managers);
            observer.complete();
          } else {
            observer.error('Unable to get managers');
          }
        },
        error: (error: any) => observer.error(error)
      });
    });
  }

  // IMAGE UTILITIES

  // Finds closest matching image for supermarket
  private findImageKey(name: string, imageKeys: string[], maxDistance: number = 4): string | null {
    const normalized = name.trim().toLowerCase();
    let minDistance = Infinity;
    let closestKey: string | null = null;
    
    for (const key of imageKeys) {
      const dist = this.calculateLevenshteinDistance(normalized, key);
      if (dist < minDistance) {
        minDistance = dist;
        closestKey = key;
      }
    }
    return minDistance <= maxDistance ? closestKey : null;
  }

  // Levenshtein distance calculation
  private calculateLevenshteinDistance(a: string, b: string): number {
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

  // Get image URL for supermarket by name
  getStoreImage(name: string): string {
    const brandName = this.extractBrandName(name);
    const key = this.findImageKey(brandName, Object.keys(this.supermarketImages), 4);
    return key ? this.supermarketImages[key] : 'assets/supermercati/def_sm.webp';
  }

  // Extract supermarket name
  private extractBrandName(name: string): string {
    if (!name) return '';
    const separators = [' - ', ' – ', ' — ', ' (', '('];
    for (const separator of separators) {
      if (name.includes(separator)) {
        return name.split(separator)[0].trim();
      }
    }
    return name.trim();
  }

  // DISTANCE UTILITIES

  // Sort supermarkets by distance
  sortByDistance(supermarkets: Supermarket[], userLat: number, userLng: number): Supermarket[] {
    return supermarkets.sort((a, b) => {
      const distA = this.posizioneService.calcDistance(userLat, userLng, a.latitude, a.longitude);
      const distB = this.posizioneService.calcDistance(userLat, userLng, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  // ROLE FILTER

  // Get supermarkets for user by role
  async getSupermarketsForCurrentUser(): Promise<Supermarket[]> {
    const user = this.authService.getCurrentAuthState().user;
    if (!user) return [];
    try {
      const response = await this.getSupermarkets().toPromise();
      const supermarkets = response?.supermarkets || [];

      if (user.role === 'manager') {
        const managedSupermarkets = supermarkets.filter(sm => {
          const managerId = sm.manager_id?.toString();
          const userId = user.id?.toString();
          return managerId === userId;
        });
        return managedSupermarkets;
      }

      return supermarkets;
    } catch (error) {
      console.error('Error loading supermarkets:', error);
      return [];
    }
  }

  // Adds products to supermarket
  async addProductsToSupermarket(supermarketId: number, products: any[]): Promise<{ success: boolean; responses: any[] }> {
    try {
      const formattedProducts = products.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: product.quantity
      }));
      const responses = await Promise.all(
        formattedProducts.map(product =>
          this.http.post(
            ApiConfig.ENDPOINTS.SUPERMARKETS.ADD_PRODUCTS_TO_SUPERMARKET(supermarketId.toString()),
            product,
            {
              withCredentials: true,
              headers: { 'Content-Type': 'application/json' }
            }
          ).toPromise()
        )
      );
      const allSuccessful = responses.every(
        (response: any) => response?.message === 'Prodotto aggiunto con successo'
      );
      return { success: allSuccessful, responses };
    } catch (error: any) {
      console.error('Error adding products to supermarket:', error);
      throw error;
    }
  }

  // Loads supermarkets
  async loadAndSetupSupermarkets(
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
}
