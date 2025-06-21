import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class OpenFoodFactsService {
  private readonly baseUrl = 'https://world.openfoodfacts.org';
  
  // Rate limiting separato per diversi tipi di richieste
  private readonly searchLimitPerMinute = 10; // Search queries limit
  private readonly productLimitPerMinute = 100; // Product queries limit
  
  // Contatori separati per search e product queries
  private searchRequestCount = 0;
  private productRequestCount = 0;
  private lastSearchMinute = Date.now();
  private lastProductMinute = Date.now();

  constructor(private http: HttpClient) {}
  /**
   * Rate limiting per search queries (10 req/min)
   */
  private canMakeSearchRequest(): boolean {
    const now = Date.now();
    const minutesPassed = (now - this.lastSearchMinute) / 60000;

    if (minutesPassed >= 1) {
      this.searchRequestCount = 0;
      this.lastSearchMinute = now;
    }

    return this.searchRequestCount < this.searchLimitPerMinute;
  }

  /**
   * Rate limiting per product queries (100 req/min)
   */
  private canMakeProductRequest(): boolean {
    const now = Date.now();
    const minutesPassed = (now - this.lastProductMinute) / 60000;

    if (minutesPassed >= 1) {
      this.productRequestCount = 0;
      this.lastProductMinute = now;
    }

    return this.productRequestCount < this.productLimitPerMinute;
  }
  /**
   * Cerca prodotti per nome - SEARCH QUERY (10 req/min limit)
   */
  searchProducts(query: string, page: number = 1, pageSize: number = 20): Observable<OpenFoodFactsSearchResponse> {
    if (!this.canMakeSearchRequest()) {
      console.warn('Search rate limit reached for OpenFoodFacts API (10 req/min)');
      return of({ count: 0, page: 1, page_count: 0, page_size: 0, products: [], skip: 0 });
    }

    this.searchRequestCount++;

    const params = new HttpParams()
      .set('search_terms', query)
      .set('search_simple', '1')
      .set('action', 'process')
      .set('json', '1')
      .set('page', page.toString())
      .set('page_size', pageSize.toString())      .set('fields', 'code,product_name,product_name_en,product_name_it,generic_name,brands,categories,categories_tags,image_url,image_front_url');

    return this.http.get<OpenFoodFactsSearchResponse>(`${this.baseUrl}/cgi/search.pl`, { 
      params
    }).pipe(
      catchError(error => {
        console.error('Errore nella ricerca OpenFoodFacts:', error);
        return of({ count: 0, page: 1, page_count: 0, page_size: 0, products: [], skip: 0 });
      })
    );
  }
  /**
   * Ottiene un prodotto specifico per barcode - PRODUCT QUERY (100 req/min limit)
   */
  getProductByBarcode(barcode: string): Observable<{ product?: OpenFoodFactsProduct; status: number; status_verbose: string }> {
    if (!this.canMakeProductRequest()) {
      console.warn('Product rate limit reached for OpenFoodFacts API (100 req/min)');
      return of({ status: 0, status_verbose: 'Rate limit reached' });
    }

    this.productRequestCount++;    return this.http.get<{ product?: OpenFoodFactsProduct; status: number; status_verbose: string }>(
      `${this.baseUrl}/api/v0/product/${barcode}.json`
    ).pipe(
      catchError(error => {
        console.error('Errore nel recupero prodotto per barcode:', error);
        return of({ status: 0, status_verbose: 'Errore nella richiesta' });
      })
    );
  }  /**
   * Verifica se è possibile effettuare una ricerca per barcode (usa product API)
   */
  canSearchByBarcode(): boolean {
    return this.canMakeProductRequest();
  }

  /**
   * Verifica se è possibile effettuare una ricerca per nome (usa search API)
   */
  canSearchByName(): boolean {
    return this.canMakeSearchRequest();
  }

  /**
   * Estrae il nome migliore del prodotto
   */
  getBestProductName(product: OpenFoodFactsProduct): string {
    return product.product_name_it || 
           product.product_name_en || 
           product.product_name || 
           product.generic_name || 
           'Prodotto senza nome';
  }

  /**
   * Estrae le categorie principali
   */
  getMainCategories(product: OpenFoodFactsProduct): string[] {
    if (!product.categories_tags) return [];
    
    return product.categories_tags
      .filter(tag => tag.startsWith('en:'))
      .map(tag => tag.replace('en:', '').replace(/-/g, ' '))
      .slice(0, 3);
  }

  /**
   * Verifica se un prodotto ha informazioni nutrizionali
   */
  hasNutritionalInfo(product: OpenFoodFactsProduct): boolean {
    return !!(product.nutriments && Object.keys(product.nutriments).length > 0);
  }

  /**
   * Ottiene l'URL migliore per l'immagine
   */
  getBestImageUrl(product: OpenFoodFactsProduct): string | null {
    return product.image_front_url || product.image_url || null;
  }

  /**
   * Ottiene informazioni sui limiti API rimanenti
   */
  getApiLimitsInfo(): { 
    searchRequests: { used: number; limit: number; remaining: number };
    productRequests: { used: number; limit: number; remaining: number };
  } {
    return {
      searchRequests: {
        used: this.searchRequestCount,
        limit: this.searchLimitPerMinute,
        remaining: this.searchLimitPerMinute - this.searchRequestCount
      },
      productRequests: {
        used: this.productRequestCount,
        limit: this.productLimitPerMinute,
        remaining: this.productLimitPerMinute - this.productRequestCount
      }
    };
  }

  /**
   * Reset manuale dei contatori (per test o debugging)
   */
  resetCounters(): void {
    this.searchRequestCount = 0;
    this.productRequestCount = 0;
    this.lastSearchMinute = Date.now();
    this.lastProductMinute = Date.now();
  }
  /**
   * Determina se una stringa è probabilmente un codice a barre
   */
  private isBarcode(query: string): boolean {
    // Rimuove spazi e trattini (caratteri comuni nei barcode)
    const cleanQuery = query.replace(/[\s-]/g, '');
    
    // Un barcode valido deve essere:
    // - SOLO numeri (nessun carattere alfabetico)
    // - Lunghezza tra 8 e 14 caratteri (EAN-8, EAN-13, UPC, etc.)
    const isNumericOnly = /^\d+$/.test(cleanQuery);
    const hasValidLength = cleanQuery.length >= 8 && cleanQuery.length <= 14;
    
    return isNumericOnly && hasValidLength;
  }

  /**
   * Ricerca intelligente che determina automaticamente il tipo di ricerca
   */
  smartSearch(query: string): Observable<{ 
    type: 'barcode' | 'name';
    results: OpenFoodFactsProduct[];
    isBarcode: boolean;
  }> {
    const trimmedQuery = query.trim();
    const isBarcode = this.isBarcode(trimmedQuery);
    
    if (isBarcode) {
      // Ricerca per barcode (usa Product API - 100 req/min)
      if (!this.canMakeProductRequest()) {
        console.warn('Product rate limit reached for OpenFoodFacts API (100 req/min)');
        return of({ type: 'barcode', results: [], isBarcode: true });
      }
        this.productRequestCount++;
      const cleanBarcode = trimmedQuery.replace(/[\s-]/g, ''); // Rimuove solo spazi e trattini
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
    } else {
      // Ricerca per nome (usa Search API - 10 req/min)
      if (!this.canMakeSearchRequest()) {
        console.warn('Search rate limit reached for OpenFoodFacts API (10 req/min)');
        return of({ type: 'name', results: [], isBarcode: false });
      }
        this.searchRequestCount++;
      
      const params = new HttpParams()
        .set('search_terms', trimmedQuery)
        .set('search_simple', '1')
        .set('action', 'process')
        .set('json', '1')
        .set('page', '1')
        .set('page_size', '10')
        .set('fields', 'code,product_name,product_name_en,product_name_it,generic_name,brands,categories,categories_tags,image_url,image_front_url');

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
}
