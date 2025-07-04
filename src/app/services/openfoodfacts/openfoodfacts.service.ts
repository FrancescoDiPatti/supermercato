import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';

// Exported interfaces

export interface OpenFoodFactsProduct {
  id: string;
  product_name: string;
  product_name_en?: string;
  product_name_it?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  code: string;
  image_url?: string;
  image_front_url?: string;
  nutriments?: any;
  ingredients_text?: string;
  allergens?: string;
  nutrient_levels?: any;
  nova_group?: number;
  ecoscore_grade?: string;
  nutriscore_grade?: string;
}

export interface OpenFoodFactsSearchResponse {
  count: number;
  page: number;
  page_count: number;
  page_size: number;
  products: OpenFoodFactsProduct[];
  skip: number;
}

export interface SmartSearchResult {
  type: 'barcode' | 'name';
  results: OpenFoodFactsProduct[];
  isBarcode: boolean;
}

// Constants

const API_BASE_URL = 'https://world.openfoodfacts.org';
const SEARCH_RATE_LIMIT = 10;
const PRODUCT_RATE_LIMIT = 100;
const SESSION_STORAGE_KEY = 'openfoodfacts_limits';

const DEFAULT_SEARCH_PARAMS = {
  pageSize: 20,
  fields: 'code,product_name,product_name_en,product_name_it,generic_name,brands,categories,categories_tags,image_url,image_front_url'
};

const BARCODE_VALIDATION = {
  minLength: 8,
  maxLength: 14
};

interface RateLimitData {
  searchCount: number;
  productCount: number;
  lastMinute: number;
}

@Injectable({
  providedIn: 'root'
})
export class OpenFoodFactsService {
  private readonly baseUrl = API_BASE_URL;

  constructor(private http: HttpClient) {}

  // PUBLIC METHODS

  // Search products by name
  searchProducts(query: string, page: number = 1, pageSize: number = DEFAULT_SEARCH_PARAMS.pageSize): Observable<OpenFoodFactsSearchResponse> {
    if (!this.canMakeSearchRequest()) {
      console.warn('Search rate limit reached for OpenFoodFacts API');
      return of({ count: 0, page: 1, page_count: 0, page_size: 0, products: [], skip: 0 });
    }
    this.incrementSearchCount();
    const params = new HttpParams()
      .set('search_terms', query)
      .set('search_simple', '1')
      .set('action', 'process')
      .set('json', '1')
      .set('page', page.toString())
      .set('page_size', pageSize.toString())
      .set('fields', DEFAULT_SEARCH_PARAMS.fields);
    return this.http.get<OpenFoodFactsSearchResponse>(`${this.baseUrl}/cgi/search.pl`, { 
      params
    }).pipe(
      catchError(error => {
        console.error('Errore nella ricerca OpenFoodFacts:', error);
        return of({ count: 0, page: 1, page_count: 0, page_size: 0, products: [], skip: 0 });
      })
    );
  }

  // Get product by barcode
  getProductByBarcode(barcode: string): Observable<{ product?: OpenFoodFactsProduct; status: number; status_verbose: string }> {
    if (!this.canMakeProductRequest()) {
      console.warn('Product rate limit reached for OpenFoodFacts API');
      return of({ status: 0, status_verbose: 'Rate limit reached' });
    }
    this.incrementProductCount();
    return this.http.get<{ product?: OpenFoodFactsProduct; status: number; status_verbose: string }>(
      `${this.baseUrl}/api/v0/product/${barcode}.json`
    ).pipe(
      catchError(error => {
        console.error('Errore nel recupero prodotto per barcode:', error);
        return of({ status: 0, status_verbose: 'Errore nella richiesta' });
      })
    );
  }

  // Search with detection
  smartSearch(query: string): Observable<SmartSearchResult> {
    const trimmedQuery = query.trim();
    const isBarcode = this.isBarcode(trimmedQuery);
    
    if (isBarcode) {
      return this.searchByBarcode(trimmedQuery);
    } else {
      return this.searchByName(trimmedQuery);
    }
  }

  //
  canSearchByBarcode(): boolean {
    return this.canMakeProductRequest();
  }
  
  canSearchByName(): boolean {
    return this.canMakeSearchRequest();
  }

  getBestProductName(product: OpenFoodFactsProduct): string {
    return product.product_name_it || 
           product.product_name_en || 
           product.product_name || 
           product.generic_name || 
           'Prodotto senza nome';
  }

  // Extract categories
  getCategories(product: OpenFoodFactsProduct): string[] {
    if (!product.categories_tags) return [];
    return product.categories_tags
      .filter(tag => tag.startsWith('en:'))
      .map(tag => tag.replace('en:', '').replace(/-/g, ' '))
      .slice(0, 3);
  }

  // Get best image
  getBestImageUrl(product: OpenFoodFactsProduct): string | null {
    return product.image_front_url || product.image_url || null;
  }

  // PRIVATE METHODS

  // Get rate limit from session storage
  private getRateLimitData(): RateLimitData {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return this.createEmptyLimitData();
    }
    const data: RateLimitData = JSON.parse(stored);
    const now = Date.now();
    if ((now - data.lastMinute) >= 60000) {
      data.searchCount = 0;
      data.productCount = 0;
      data.lastMinute = now;
    }
    return data;
  }

  // Save rate limit to session storage
  private saveRateLimitData(data: RateLimitData): void {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  }

  // Create empty limit data
  private createEmptyLimitData(): RateLimitData {
    const now = Date.now();
    return {
      searchCount: 0,
      productCount: 0,
      lastMinute: now
    };
  }

  // Check if search request can be made
  private canMakeSearchRequest(): boolean {
    const limits = this.getRateLimitData();
    return limits.searchCount < SEARCH_RATE_LIMIT;
  }

  // Check if product request can be made
  private canMakeProductRequest(): boolean {
    const limits = this.getRateLimitData();
    return limits.productCount < PRODUCT_RATE_LIMIT;
  }

  // Increment search count
  private incrementSearchCount(): void {
    const limits = this.getRateLimitData();
    limits.searchCount++;
    this.saveRateLimitData(limits);
  }

  // Increment product count
  private incrementProductCount(): void {
    const limits = this.getRateLimitData();
    limits.productCount++;
    this.saveRateLimitData(limits);
  }

  // Check if string is a barcode
  private isBarcode(query: string): boolean {
    const cleanQuery = query.replace(/[\s-]/g, '');
    const isNumericOnly = /^\d+$/.test(cleanQuery);
    const hasValidLength = cleanQuery.length >= BARCODE_VALIDATION.minLength && cleanQuery.length <= BARCODE_VALIDATION.maxLength;
    return isNumericOnly && hasValidLength;
  }

  // Search by barcode
  private searchByBarcode(query: string): Observable<SmartSearchResult> {
    if (!this.canMakeProductRequest()) {
      console.warn('Product rate limit reached for OpenFoodFacts API');
      return of({ type: 'barcode', results: [], isBarcode: true });
    }
    this.incrementProductCount();
    const cleanBarcode = query.replace(/[\s-]/g, '');
    return this.http.get<{ product?: OpenFoodFactsProduct; status: number; status_verbose: string }>(
      `${this.baseUrl}/api/v0/product/${cleanBarcode}.json`
    ).pipe(
      map(response => ({
        type: 'barcode' as const,
        results: response.status === 1 && response.product ? [response.product] : [],
        isBarcode: true
      })),
      catchError(error => {
        console.error('Errore nella ricerca per barcode:', error);
        return of({ type: 'barcode' as const, results: [], isBarcode: true });
      })
    );
  }

  // Search by name
  private searchByName(query: string): Observable<SmartSearchResult> {
    if (!this.canMakeSearchRequest()) {
      console.warn('Search rate limit reached for OpenFoodFacts API');
      return of({ type: 'name', results: [], isBarcode: false });
    }
    this.incrementSearchCount();
    const params = new HttpParams()
      .set('search_terms', query)
      .set('search_simple', '1')
      .set('action', 'process')
      .set('json', '1')
      .set('page', '1')
      .set('page_size', '10')
      .set('fields', DEFAULT_SEARCH_PARAMS.fields);
    return this.http.get<OpenFoodFactsSearchResponse>(`${this.baseUrl}/cgi/search.pl`, { 
      params
    }).pipe(
      map(response => ({
        type: 'name' as const,
        results: response.products || [],
        isBarcode: false
      })),
      catchError(error => {
        console.error('Errore nella ricerca per nome:', error);
        return of({ type: 'name' as const, results: [], isBarcode: false });
      })
    );
  }
}
