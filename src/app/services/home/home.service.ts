import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiConfig } from '../../config/api.config';

import { SupermercatiService, Supermarket, User } from '../supermercati/supermercati.service';
import { ProdottiService } from '../prodotti/prodotti.service';
import { PosizioneService } from '../posizione/posizione.service';
import { SearchService, SearchResult, RecentSearch } from '../search/search.service';
import { UiService, AnimationState, SupermarketDataState } from '../ui/ui.service';
import { MapService, LeafletEvent } from '../map/map.service';
import { AuthService } from '../../auth/auth.service';
import { CarrelloService, CartItem } from '../carrello/carrello.service';
import { OpenFoodFactsService } from '../openfoodfacts/openfoodfacts.service';

// Service Inferface

export interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  on_offer: boolean;
  offer_price?: number;
  image_url?: string;
  barcode?: string;
}

export interface Category {
  name: string;
  icon: string;
  count: number;
}

export interface PurchaseHistory {
  id: number;
  product_name: string;
  supermarket_name: string;
  quantity: number;
  total_price: number;
  purchase_date: string;
}

export interface SupermarketDataResult {
  products: Product[];
  offerProducts: Product[];
}

export { SearchResult, RecentSearch } from '../search/search.service';
export { LeafletEvent } from '../map/map.service';
export { CartItem } from '../carrello/carrello.service';
export { AnimationState, SupermarketDataState } from '../ui/ui.service';
export { Supermarket, User } from '../supermercati/supermercati.service';

@Injectable({
  providedIn: 'root'
})
export class HomeService {
  private authService = inject(AuthService);
  
  constructor(
    private http: HttpClient,
    private supermercatiService: SupermercatiService,
    private prodottiService: ProdottiService,
    private posizioneService: PosizioneService,
    private searchService: SearchService,
    private uiService: UiService,
    private mapService: MapService,
    private carrelloService: CarrelloService,
    private openFoodFactsService: OpenFoodFactsService
  ) {}


  // Home Service Methods

  getHome(): Observable<any> {
    return this.http.get(ApiConfig.ENDPOINTS.DASHBOARD, { withCredentials: true });
  }

  // Load supermarket data
  async loadSupermarketDataWithoutImages(
    supermarketId: number,
    dataState?: SupermarketDataState,
    includeProducts: boolean = true,
    includeOffers: boolean = true
  ): Promise<SupermarketDataResult> {
    const results: SupermarketDataResult = { products: [], offerProducts: [] };
    
    if (includeOffers) {
      results.offerProducts = await this.prodottiService.loadSupermarketOffers(supermarketId, false);
    }
    
    if (includeProducts) {
      const allProducts = await this.prodottiService.loadSupermarketProducts(supermarketId, false);
      this.uiService.updateInventoryFromProducts(allProducts, supermarketId);

      if (results.offerProducts?.length > 0) {
        const offerProductIds = new Set(results.offerProducts.map((offer: any) => offer.id));
        results.products = allProducts.filter((product: any) => !offerProductIds.has(product.id));
      } else {
        results.products = allProducts;
      }
    }

    if (dataState) {
      if (includeProducts) {
        this.uiService.updateProducts(dataState, results.products);
      }
      if (includeOffers) {
        this.uiService.updateOfferProducts(dataState, results.offerProducts);
      }
    }
    
    return results;
  }
  // Service getters
  get supermarkets() { return this.supermercatiService; }
  get products() { return this.prodottiService; }
  get cart() { return this.carrelloService; }
  get ui() { return this.uiService; }
  get map() { return this.mapService; }
  get position() { return this.posizioneService; }
  get openFoodFacts() { return this.openFoodFactsService; }

  // === USER MANAGEMENT ===
  
  getCurrentUser(): any {
    return this.authService.getUser();
  }

  isUserAdmin(user?: any): boolean {
    const targetUser = user || this.getCurrentUser();
    return targetUser?.role === 'admin';
  }

  isUserManager(user?: any): boolean {
    const targetUser = user || this.getCurrentUser();
    return targetUser?.role === 'manager';
  }

  isUserCustomer(user?: any): boolean {
    const targetUser = user || this.getCurrentUser();
    return targetUser?.role === 'customer';
  }

  isUserAdminOrManager(user?: any): boolean {
    const targetUser = user || this.getCurrentUser();
    return targetUser?.role === 'admin' || targetUser?.role === 'manager';
  }
}
