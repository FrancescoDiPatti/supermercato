import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../config/api.config';
import { OpenFoodFactsService } from '../openfoodfacts.service';

@Injectable({
  providedIn: 'root'
})
export class ProdottiService {
  // Product image caching constants
  private readonly PRODUCT_IMAGE_CACHE_KEY = 'productImageCache';
  private readonly CACHE_EXPIRY_DAYS = 7;
  private imageCache: Map<string, { url: string; timestamp: number }> = new Map();
  
  // Rate limiting for product image requests
  private readonly BATCH_SIZE = 5; // Process 5 products at a time
  private readonly BATCH_DELAY = 3000; // 3 seconds between batches
  constructor(
    private http: HttpClient,
    private openFoodFactsService: OpenFoodFactsService
  ) {
    this.loadImageCache();
  }
  
  generateOffers(supermarketId: number) {
    return this.http.post(`${ApiConfig.PRIMARY_BASE_URL}/generate_offers/${supermarketId}`, {});
  }

  // === PRODUCT IMAGE CACHING UTILITIES ===
  
  private loadImageCache(): void {
    const cached = localStorage.getItem(this.PRODUCT_IMAGE_CACHE_KEY);
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        this.imageCache = new Map();
        for (const [key, value] of Object.entries(cacheData)) {
          this.imageCache.set(key, value as { url: string; timestamp: number });
        }
        this.cleanExpiredCache();      } catch (error) {
        // Ignore cache loading errors
      }
    }
  }

  private saveImageCache(): void {
    const cacheObj: { [key: string]: { url: string; timestamp: number } } = {};
    this.imageCache.forEach((value, key) => {
      cacheObj[key] = value;
    });
    localStorage.setItem(this.PRODUCT_IMAGE_CACHE_KEY, JSON.stringify(cacheObj));
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    const expiry = this.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    for (const [key, value] of this.imageCache.entries()) {
      if (now - value.timestamp > expiry) {
        this.imageCache.delete(key);
      }
    }
    this.saveImageCache();
  }
  private calculateDiscountPercentage(originalPrice: number | string, offerPrice: number | string): number {
    const original = typeof originalPrice === 'string' ? parseFloat(originalPrice) || 0 : originalPrice || 0;
    const offer = typeof offerPrice === 'string' ? parseFloat(offerPrice) || 0 : offerPrice || 0;
    if (original <= 0 || offer >= original) {
      return 0;
    }
    const discount = ((original - offer) / original) * 100;
    return Math.round(discount * 10) / 10;
  }
  private rateLimitDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 650)); // ~90 requests per minute
  }

  /**
   * Ottiene l'immagine di un prodotto prioritizzando la ricerca per barcode
   * Rispetta i limiti di rate di OpenFoodFacts: 100 req/min per barcode, 10 req/min per search
   */
  async getProductImage(productName: string, barcode?: string): Promise<string> {
    // Priorità 1: Usa sempre il barcode se disponibile come chiave cache
    const cacheKey = barcode || productName.toLowerCase();
    
    // Check cache first
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      return cached.url;
    }

    let imageUrl = '';
    
    try {
      // Priorità 2: Se abbiamo un barcode, usa SOLO la ricerca per barcode (100 req/min limit)
      if (barcode && barcode.trim()) {        if (this.openFoodFactsService.canSearchByBarcode()) {
          const productResult = await this.openFoodFactsService.getProductByBarcode(barcode.trim()).toPromise();
          if (productResult?.product) {
            imageUrl = this.openFoodFactsService.getBestImageUrl(productResult.product) || '';
          }
        } else {
          // Rate limit reached for barcode search
        }
      }
      
      // Priorità 3: Solo se NON abbiamo barcode E la ricerca per barcode ha fallito,
      // usa la ricerca per nome (ma solo se abbiamo ancora richieste disponibili)
      if (!imageUrl && !barcode) {
        if (this.openFoodFactsService.canSearchByName()) {
          const searchResult = await this.openFoodFactsService.searchProducts(productName, 1, 1).toPromise();
          if (searchResult?.products?.[0]) {
            imageUrl = this.openFoodFactsService.getBestImageUrl(searchResult.products[0]) || '';
          }
        } else {
          // Rate limit reached for name search
        }
      }
      
    } catch (error) {
      // Error retrieving product image
    }
    
    // Cache il risultato (anche se vuoto) per evitare richieste duplicate
    const fallbackUrl = imageUrl || 'assets/icon/favicon.png';
    this.imageCache.set(cacheKey, {
      url: fallbackUrl,
      timestamp: Date.now()
    });
    this.saveImageCache();
    
    return fallbackUrl;
  }
  /**
   * Carica le immagini per un batch di prodotti rispettando i rate limits
   * Ottimizzato per evitare richieste duplicate su barcode uguali
   */  private async loadProductImagesInBatches(products: any[]): Promise<void> {
    // Separa prodotti con e senza barcode per ottimizzare l'uso dei rate limits
    const productsWithBarcode = products.filter(p => p.barcode && p.barcode.trim());
    const productsWithoutBarcode = products.filter(p => !p.barcode || !p.barcode.trim());
    
    // Prima carica le immagini per prodotti con barcode (100 req/min limit)
    // Raggruppa per barcode unico per evitare richieste duplicate
    await this.processBatchWithUniqueRequests(productsWithBarcode, 'barcode');
    
    // Poi carica le immagini per prodotti senza barcode (10 req/min limit - più limitante)
    // Raggruppa per nome unico per evitare richieste duplicate
    await this.processBatchWithUniqueRequests(productsWithoutBarcode, 'name');
  }
  
  /**
   * Processa un batch di prodotti raggruppando per identificatore unico (barcode o nome)
   */
  private async processBatchWithUniqueRequests(products: any[], searchType: 'barcode' | 'name'): Promise<void> {
    if (products.length === 0) return;
    
    // Raggruppa prodotti per identificatore unico
    const uniqueMap = new Map<string, any[]>();
    
    products.forEach(product => {
      const key = searchType === 'barcode' ? product.barcode : product.name.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, []);
      }
      uniqueMap.get(key)!.push(product);
    });
      const uniqueKeys = Array.from(uniqueMap.keys());
    
    // Processa in batch gli identificatori unici
    const batchSize = searchType === 'barcode' ? this.BATCH_SIZE * 4 : this.BATCH_SIZE;
    
    for (let i = 0; i < uniqueKeys.length; i += batchSize) {
      const batchKeys = uniqueKeys.slice(i, i + batchSize);
      
      // Processa il batch corrente di identificatori unici
      const promises = batchKeys.map(async (key) => {
        const productsWithSameKey = uniqueMap.get(key)!;
        const representativeProduct = productsWithSameKey[0];
        
        try {
          let imageUrl: string;
          if (searchType === 'barcode') {
            imageUrl = await this.getProductImage(representativeProduct.name, representativeProduct.barcode);
          } else {
            imageUrl = await this.getProductImage(representativeProduct.name);
          }          
          // Applica l'immagine a tutti i prodotti con lo stesso identificatore
          productsWithSameKey.forEach(product => {
            product.image_url = imageUrl;
          });
          
        } catch (error) {
          // Error loading image, apply fallback
          // Applica fallback a tutti i prodotti con lo stesso identificatore
          productsWithSameKey.forEach(product => {
            product.image_url = 'assets/icon/favicon.png';
          });
        }
      });
      
      await Promise.all(promises);
        // Aspetta tra un batch e l'altro solo se non è l'ultimo batch
      if (i + batchSize < uniqueKeys.length) {
        const delay = searchType === 'barcode' ? this.BATCH_DELAY / 2 : this.BATCH_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  /**
   * Carica le immagini per prodotti con feedback sul progresso
   * Ottimizzato per evitare richieste duplicate su barcode uguali
   */
  async loadProductImagesWithProgress(
    products: any[], 
    onProgress?: (current: number, total: number, type: 'barcode' | 'name') => void
  ): Promise<void> {
    const productsWithBarcode = products.filter(p => p.barcode && p.barcode.trim());
    const productsWithoutBarcode = products.filter(p => !p.barcode || !p.barcode.trim());
    
    // Carica prima i prodotti con barcode
    if (productsWithBarcode.length > 0) {
      await this.processBatchWithProgressAndUniqueRequests(productsWithBarcode, 'barcode', onProgress);
    }
    
    // Poi carica i prodotti senza barcode
    if (productsWithoutBarcode.length > 0) {
      await this.processBatchWithProgressAndUniqueRequests(productsWithoutBarcode, 'name', onProgress);
    }
  }
  
  private async processBatchWithProgressAndUniqueRequests(
    products: any[], 
    searchType: 'barcode' | 'name',
    onProgress?: (current: number, total: number, type: 'barcode' | 'name') => void
  ): Promise<void> {
    // Raggruppa prodotti per identificatore unico
    const uniqueMap = new Map<string, any[]>();
    
    products.forEach(product => {
      const key = searchType === 'barcode' ? product.barcode : product.name.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, []);
      }
      uniqueMap.get(key)!.push(product);
    });
    
    const uniqueKeys = Array.from(uniqueMap.keys());
    const batchSize = searchType === 'barcode' ? this.BATCH_SIZE * 4 : this.BATCH_SIZE;
    let processedProducts = 0;
    
    for (let i = 0; i < uniqueKeys.length; i += batchSize) {
      const batchKeys = uniqueKeys.slice(i, i + batchSize);
      
      const promises = batchKeys.map(async (key) => {
        const productsWithSameKey = uniqueMap.get(key)!;
        const representativeProduct = productsWithSameKey[0];
        
        try {
          let imageUrl: string;
          if (searchType === 'barcode') {
            imageUrl = await this.getProductImage(representativeProduct.name, representativeProduct.barcode);
          } else {
            imageUrl = await this.getProductImage(representativeProduct.name);
          }
          
          // Applica l'immagine a tutti i prodotti con lo stesso identificatore
          productsWithSameKey.forEach(product => {
            product.image_url = imageUrl;
          });
            processedProducts += productsWithSameKey.length;
          onProgress?.(processedProducts, products.length, searchType);
          
        } catch (error) {
          // Error loading image, apply fallback
          productsWithSameKey.forEach(product => {
            product.image_url = 'assets/icon/favicon.png';
          });
          
          processedProducts += productsWithSameKey.length;
          onProgress?.(processedProducts, products.length, searchType);
        }
      });
      
      await Promise.all(promises);
      
      if (i + batchSize < uniqueKeys.length) {
        const delay = searchType === 'barcode' ? this.BATCH_DELAY / 2 : this.BATCH_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Carica le immagini per prodotti già caricati e aggiorna la cache con i risultati
   * Unifica prodotti e offerte per evitare richieste duplicate
   */
  async loadImagesForLoadedProducts(allProducts: any[]): Promise<void> {
    if (allProducts.length === 0) return;
    
    // Deduplicazione globale su TUTTI i prodotti (prodotti + offerte)
    const uniqueMap = new Map<string, any[]>();
    
    allProducts.forEach(product => {
      const key = product.barcode && product.barcode.trim() 
        ? product.barcode.trim() 
        : product.name.toLowerCase();
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, []);
      }
      uniqueMap.get(key)!.push(product);
    });    
    const uniqueKeys = Array.from(uniqueMap.keys());
    
    // Separa per tipo di ricerca
    const barcodeKeys = uniqueKeys.filter(key => {
      const products = uniqueMap.get(key)!;
      return products[0].barcode && products[0].barcode.trim();
    });
    
    const nameKeys = uniqueKeys.filter(key => {
      const products = uniqueMap.get(key)!;
      return !products[0].barcode || !products[0].barcode.trim();    });
    
    // Processa prima i barcode (100 req/min limit)
    await this.processUniqueKeys(barcodeKeys, uniqueMap, 'barcode');
    
    // Poi processa i nomi (10 req/min limit)
    await this.processUniqueKeys(nameKeys, uniqueMap, 'name');
    
    // Assegna immagini di fallback per prodotti senza risultati
    this.assignDefaultImages(allProducts);
  }
  
  private async processUniqueKeys(
    keys: string[], 
    uniqueMap: Map<string, any[]>, 
    searchType: 'barcode' | 'name'
  ): Promise<void> {
    if (keys.length === 0) return;
    
    const batchSize = searchType === 'barcode' ? this.BATCH_SIZE * 4 : this.BATCH_SIZE;
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batchKeys = keys.slice(i, i + batchSize);
      
      const promises = batchKeys.map(async (key) => {
        const productsWithSameKey = uniqueMap.get(key)!;
        const representativeProduct = productsWithSameKey[0];
        
        try {
          let imageUrl: string;
          if (searchType === 'barcode') {
            imageUrl = await this.getProductImage(representativeProduct.name, representativeProduct.barcode);
          } else {
            imageUrl = await this.getProductImage(representativeProduct.name);
          }
          
          // Applica l'immagine a tutti i prodotti con lo stesso identificatore
          productsWithSameKey.forEach(product => {
            product.image_url = imageUrl;
          });
            } catch (error) {
          // Error loading image for product batch
          productsWithSameKey.forEach(product => {
            product.image_url = 'assets/icon/favicon.png';
          });
        }
      });
      
      await Promise.all(promises);
        if (i + batchSize < keys.length) {
        const delay = searchType === 'barcode' ? this.BATCH_DELAY / 2 : this.BATCH_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // === CATEGORY UTILITIES ===
  getCategoryIcon(category: string): string {
    const iconMap: { [key: string]: string } = {
      'Frutta': 'assets/categories/fruit.png',
      'Verdura': 'assets/categories/cabbage.png',
      'Carne': 'assets/categories/meat.png',
      'Pesce': 'assets/categories/seafood.png',
      'Panetteria': 'assets/categories/bread.png',
      'Latticini': 'assets/categories/milk.png',
      'Bevande': 'assets/categories/drinks.png',
      'Alcolici': 'assets/categories/wine-bottle.png',
      'Snack': 'assets/categories/snacks.png',
      'Pasticceria': 'assets/categories/cake.png',
      'Surgelati': 'assets/categories/fish.png',
      'Igiene': 'assets/categories/soap.png',
      'Casa': 'assets/categories/cleaning-tools.png',
      'Cosmetici': 'assets/categories/cosmetology.png',
      'Condimenti': 'assets/categories/ketchup.png',
      'Giardinaggio': 'assets/categories/shovel.png',
      'Pasta': 'assets/categories/spaghetti.png',
      'Riso': 'assets/categories/rice.png',
      'Biscotti': 'assets/categories/cookies.png',
      'Cereali': 'assets/categories/cereal.png',
      'Mobili': 'assets/categories/furniture.png',
      'Animali': 'assets/categories/pet-food.png',
      'Vestiti': 'assets/categories/clothes-hanger.png',
      'Elettronica': 'assets/categories/smart-tv.png',
      'Altro': 'assets/categories/packing.png'
    };
    
    const iconPath = iconMap[category] || 'assets/categories/packing.png';
    return iconPath;
  }

  generateCategories(products: any[]): Array<{ name: string; icon: string; count: number }> {
    const categoryMap = new Map<string, number>();
    products.forEach(product => {
      let category = 'Altro';
      if (product.category) {
        category = product.category;
      } 
      else if (product.product_category) {
        category = product.product_category;
      }
      else if (product.offers && Array.isArray(product.offers)) {
        product.offers.forEach((offer: any) => {
          const offerCategory = offer.product_category || 'Altro';
          categoryMap.set(offerCategory, (categoryMap.get(offerCategory) || 0) + 1);
        });
        return;
      }
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const result = Array.from(categoryMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({
        name,
        count,
        icon: this.getCategoryIcon(name)
      }));
    return result;
  }

  // === PRODUCT UTILITIES ===
  
  getDisplayPrice(product: any): number {
    return product.on_offer && product.offer_price ? product.offer_price : product.price;
  }

  getOriginalPrice(product: any): number | null {
    return product.on_offer && product.offer_price ? product.price : null;
  }

  filterProductsByCategory(products: any[], categoryName: string): any[] {
    if (!categoryName || categoryName === '') {
      return [...products];
    }
    return products.filter(product => {
      let productCategory = 'Altro';
      if (product.category) {
        productCategory = product.category;
      } 
      else if (product.product_category) {
        productCategory = product.product_category;
      }
      else if (product.offers && Array.isArray(product.offers)) {
        return product.offers.some((offer: any) => {
          const offerCategory = offer.product_category || 'Altro';
          return offerCategory === categoryName;
        });
      }
      return productCategory === categoryName;
    });
  }

  async loadDashboardProducts(): Promise<any[]> {
  try {
    const response = await this.http.get<any>(
      ApiConfig.ENDPOINTS.DASHBOARD,
      { withCredentials: true }
    ).toPromise();

    const products = response?.data?.products || [];

    if (products.length > 0) {
      this.cleanAndValidateBarcodes(products);
      await this.loadProductImagesInBatches(products);
      this.assignDefaultImages(products);
    }

    return products;
  } catch (error) {
    return [];
  }
}

  // === PRODUCT CREATION ===
  
  async createProduct(product: any): Promise<any> {
    try {
      const response = await this.http.post(
        ApiConfig.ENDPOINTS.PRODUCTS.ADD,
        product,
        { withCredentials: true }
      ).toPromise();
      
      return response;    } catch (error) {
      throw error;
    }
  }
  // === PRODUCT LOADING UTILITIES ===
    async loadSupermarketProducts(supermarketId: number): Promise<any[]> {
    try {
      const response = await this.http.get<any>(
        ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      const products = response.products || [];
      
      if (products.length > 0) {
        // Use batch system to load images respecting rate limits
        await this.loadProductImagesInBatches(products);
        // Assign default fallback images based on category
        this.assignDefaultImages(products);
      }
      
      return products;
    } catch (error) {
      return [];
    }
  }

  async loadSupermarketOffers(supermarketId: number): Promise<any[]> {
    try {
      const response = await this.http.get<any>(
        ApiConfig.ENDPOINTS.OFFERS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      if (response?.data?.offers) {
        const offerProducts = response.data.offers.map((offer: any) => ({
          ...offer,
          id: offer.product_id,
          name: offer.product_name,
          description: offer.product_description || '',
          category: offer.category || '',
          price: offer.original_price,
          offer_price: offer.offer_price,
          on_offer: true,
          quantity: 1,
          barcode: offer.product_barcode
        }));

        if (offerProducts.length > 0) {
          this.cleanAndValidateBarcodes(offerProducts);
          await this.loadProductImagesInBatches(offerProducts);
          this.assignDefaultImages(offerProducts);
        }
        
        return offerProducts;
      }
      return [];    } catch (error) {
      return [];
    }
  }
  async loadPurchaseHistory(limit: number = 5): Promise<any[]> {
    try {      const response = await this.http.get<{ purchases: any[] }>(
        ApiConfig.ENDPOINTS.PURCHASES, 
        { withCredentials: true }
      ).toPromise();
      return response?.purchases?.slice(0, limit) || [];    } catch (error) {
      return [];
    }
  }

  // === PRODUCT LOADING UTILITIES (WITHOUT IMAGES) ===
  
  async loadSupermarketProductsWithoutImages(supermarketId: number): Promise<any[]> {
    try {
      const response = await this.http.get<{ products: any[] }>(
        ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      const products = response?.products || [];
      
      if (products.length > 0) {
        this.cleanAndValidateBarcodes(products);
      }
      
      return products;    } catch (error) {
      return [];
    }
  }

  async loadSupermarketOffersWithoutImages(supermarketId: number): Promise<any[]> {
    try {
      const response = await this.http.get<any>(
        ApiConfig.ENDPOINTS.OFFERS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      if (!response?.data?.offers?.length) {
        return [];
      }
      const allOffers = response.data.offers.map((offer: any) => ({
        id: offer.product_id,
        name: offer.product_name,
        description: offer.product_description || '',
        category: offer.product_category || 'Altro',
        price: parseFloat(offer.original_price) || 0,
        offer_price: parseFloat(offer.offer_price) || 0,
        discount_percentage: this.calculateDiscountPercentage(offer.original_price, offer.offer_price),
        on_offer: true,
        quantity: 1,
        barcode: offer.product_barcode,
        original_offer: offer,
        end_date: offer.end_date
      }));
      
      if (allOffers.length === 0) {
        return [];
      }
      this.cleanAndValidateBarcodes(allOffers);
      const offersByProduct = new Map<number, any[]>();
      allOffers.forEach((offer: any) => {
        if (!offersByProduct.has(offer.id)) {
          offersByProduct.set(offer.id, []);
        }
        offersByProduct.get(offer.id)?.push(offer);
      });
      const bestOffers: any[] = [];
      for (const [productId, offers] of offersByProduct.entries()) {
        if (offers.length === 1) {
          bestOffers.push(offers[0]);
        } else {
          const bestOffer = offers.reduce((best, current) => {
            if (current.discount_percentage > best.discount_percentage) {
              return current;
            } else if (current.discount_percentage === best.discount_percentage) {
              if (current.end_date && best.end_date) {
                return new Date(current.end_date) < new Date(best.end_date) ? current : best;
              }
              return best;
            }
            return best;
          }, offers[0]);
          bestOffers.push(bestOffer);
        }
      }
      return bestOffers;
    } catch (error) {
      console.error('Error loading offers:', error);
      return [];
    }
  }

  /**
   * Ottiene statistiche sui rate limits di OpenFoodFacts
   */
  getRateLimitInfo() {
    return this.openFoodFactsService.getApiLimitsInfo();
  }
  
  /**
   * Verifica se è possibile fare richieste per immagini
   */
  canLoadImages(): { barcode: boolean; search: boolean } {
    return {
      barcode: this.openFoodFactsService.canSearchByBarcode(),
      search: this.openFoodFactsService.canSearchByName()
    };
  }
  
  /**
   * Resetta i contatori dei rate limits (per debugging)
   */
  resetRateLimits(): void {
    this.openFoodFactsService.resetCounters();
  }

  /**
   * Assegna immagini di fallback basate sulla categoria per prodotti senza immagine
   */
  private assignDefaultImages(products: any[]): void {
    const categoryImageMap: { [key: string]: string } = {
      'pane': 'assets/categories/bread.png',
      'bread': 'assets/categories/bread.png',
      'latte': 'assets/categories/milk.png',
      'milk': 'assets/categories/milk.png',
      'dairy': 'assets/categories/milk.png',
      'carne': 'assets/categories/meat.png',
      'meat': 'assets/categories/meat.png',
      'pesce': 'assets/categories/fish.png',
      'fish': 'assets/categories/fish.png',
      'frutta': 'assets/categories/fruit.png',
      'fruit': 'assets/categories/fruit.png',
      'verdura': 'assets/categories/cabbage.png',
      'vegetables': 'assets/categories/cabbage.png',
      'bevande': 'assets/categories/drinks.png',
      'drinks': 'assets/categories/drinks.png',
      'dolci': 'assets/categories/cake.png',
      'sweets': 'assets/categories/cake.png',
      'cake': 'assets/categories/cake.png',
      'biscotti': 'assets/categories/cookies.png',
      'cookies': 'assets/categories/cookies.png',
      'cereali': 'assets/categories/cereal.png',
      'cereal': 'assets/categories/cereal.png',
      'riso': 'assets/categories/rice.png',
      'rice': 'assets/categories/rice.png',
      'condimenti': 'assets/categories/ketchup.png',
      'condiments': 'assets/categories/ketchup.png',
      'pulizia': 'assets/categories/cleaning-tools.png',
      'cleaning': 'assets/categories/cleaning-tools.png',
      'cosmetici': 'assets/categories/cosmetology.png',
      'cosmetics': 'assets/categories/cosmetology.png',
      'animali': 'assets/categories/pet-food.png',
      'pet': 'assets/categories/pet-food.png'
    };
    
    products.forEach(product => {
      if (!product.image_url || product.image_url === 'assets/icon/favicon.png') {
        const category = product.category?.toLowerCase() || '';
        const categoryImage = Object.keys(categoryImageMap).find(key => 
          category.includes(key)
        );
        
        if (categoryImage) {
          product.image_url = categoryImageMap[categoryImage];
        } else {
          // Fallback generico
          product.image_url = 'assets/categories/packing.png';
        }
      }
    });
  }
  /**
   * Valida se una stringa è un barcode valido
   */
  private isValidBarcode(barcode: string): boolean {
    if (!barcode || typeof barcode !== 'string') return false;
    
    const cleanBarcode = barcode.replace(/[\s-]/g, '');
    const isNumericOnly = /^\d+$/.test(cleanBarcode);
    const hasValidLength = cleanBarcode.length >= 8 && cleanBarcode.length <= 14;
    
    return isNumericOnly && hasValidLength;
  }
  
  /**
   * Pulisce e valida i barcode nei prodotti
   */
  private cleanAndValidateBarcodes(products: any[]): void {
    products.forEach(product => {
      if (product.barcode) {
        if (this.isValidBarcode(product.barcode)) {
          // Pulisce il barcode rimuovendo spazi e trattini
          product.barcode = product.barcode.replace(/[\s-]/g, '');
        } else {
          // Rimuove barcode non validi
          product.barcode = null;
        }
      }
    });
  }

  /**
   * Analizza la deduplicazione potenziale dei prodotti per barcode/nome
   */
  analyzeProductDeduplication(products: any[]): {
    withBarcode: { total: number; unique: number; duplicates: number; duplicatesByBarcode: {[key: string]: number} };
    withoutBarcode: { total: number; unique: number; duplicates: number; duplicatesByName: {[key: string]: number} };
  } {
    const productsWithBarcode = products.filter(p => p.barcode && p.barcode.trim());
    const productsWithoutBarcode = products.filter(p => !p.barcode || !p.barcode.trim());
    
    // Analizza prodotti con barcode
    const barcodeMap = new Map<string, number>();
    productsWithBarcode.forEach(product => {
      const barcode = product.barcode;
      barcodeMap.set(barcode, (barcodeMap.get(barcode) || 0) + 1);
    });
    
    const duplicatesByBarcode: {[key: string]: number} = {};
    barcodeMap.forEach((count, barcode) => {
      if (count > 1) {
        duplicatesByBarcode[barcode] = count;
      }
    });
    
    // Analizza prodotti senza barcode
    const nameMap = new Map<string, number>();
    productsWithoutBarcode.forEach(product => {
      const name = product.name.toLowerCase();
      nameMap.set(name, (nameMap.get(name) || 0) + 1);
    });
    
    const duplicatesByName: {[key: string]: number} = {};
    nameMap.forEach((count, name) => {
      if (count > 1) {
        duplicatesByName[name] = count;
      }
    });
    
    return {
      withBarcode: {
        total: productsWithBarcode.length,
        unique: barcodeMap.size,
        duplicates: productsWithBarcode.length - barcodeMap.size,
        duplicatesByBarcode
      },
      withoutBarcode: {
        total: productsWithoutBarcode.length,
        unique: nameMap.size,
        duplicates: productsWithoutBarcode.length - nameMap.size,
        duplicatesByName
      }
    };
  }
}
