import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../config/api.config';
import { OpenFoodFactsService } from '../openfoodfacts.service';

@Injectable({
  providedIn: 'root'
})
export class ProdottiService {
  // === CONFIGURATION CONSTANTS ===
  private readonly PRODUCT_IMAGE_CACHE_KEY = 'productImageCache';
  private readonly CACHE_EXPIRY_DAYS = 7;
  private readonly MAX_CONCURRENT_REQUESTS = 5;
  private readonly DELAY_BETWEEN_BATCHES_MS = 1000;
  private readonly FALLBACK_IMAGE = 'assets/icon/favicon.png';
  private readonly REGULAR_PRODUCTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // === STATE MANAGEMENT ===
  private imageCache: Map<string, { url: string; timestamp: number }> = new Map();
  private cachedRegularProducts: Map<number, { products: any[], timestamp: number }> = new Map();

  constructor(
    private http: HttpClient,
    private openFoodFactsService: OpenFoodFactsService
  ) {
    this.loadImageCache();
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
        this.cleanExpiredCache();
      } catch (error) {
        console.error('Error loading image cache:', error);
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
  }  /**
   * Gets product image ONLY using barcode lookup with enhanced caching
   * NO name search fallback - respects OpenFoodFacts rate limits (100 req/min for product queries)
   */
  async getProductImage(productName: string, barcode?: string): Promise<string> {
    // Early return for missing barcode
    const normalizedBarcode = barcode?.trim();
    if (!normalizedBarcode) {
      console.log(`No barcode available for product: ${productName}, using fallback image`);
      return this.FALLBACK_IMAGE;
    }

    const cacheKey = normalizedBarcode;
    
    // Check cache first - most common case
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      return cached.url;
    }

    // Check rate limit before making request
    if (!this.openFoodFactsService.canSearchByBarcode()) {
      console.warn(`Barcode rate limit reached for product: ${productName} (barcode: ${normalizedBarcode})`);
      return this.cacheAndReturn(cacheKey, this.FALLBACK_IMAGE);
    }

    try {
      const response = await this.openFoodFactsService.getProductByBarcode(cacheKey).toPromise();
      const imageUrl = response?.product ? 
        this.openFoodFactsService.getBestImageUrl(response.product) || '' : '';
      
      const finalUrl = imageUrl || this.FALLBACK_IMAGE;
      return this.cacheAndReturn(cacheKey, finalUrl);
      
    } catch (error) {
      console.error(`Error fetching product image for barcode ${normalizedBarcode}:`, error);
      return this.cacheAndReturn(cacheKey, this.FALLBACK_IMAGE);
    }
  }

  /**
   * Helper method to cache result and return URL
   */
  private cacheAndReturn(cacheKey: string, url: string): string {
    this.imageCache.set(cacheKey, {
      url,
      timestamp: Date.now()
    });
    this.saveImageCache();
    return url;
  }  /**
   * Optimized batch load images for products with barcodes ONLY
   * Products without barcodes will get fallback images immediately
   */
  async batchLoadProductImages(products: any[]): Promise<void> {
    if (!products?.length) return;

    // Partition products by barcode availability (single pass)
    const { withBarcodes, withoutBarcodes } = this.partitionProductsByBarcode(products);

    console.log(`Processing ${products.length} products: ${withBarcodes.length} with barcodes (will fetch), ${withoutBarcodes.length} without barcodes (fallback image)`);

    // Set fallback images immediately for products without barcodes
    this.setFallbackImages(withoutBarcodes);

    // Process only products with barcodes if any exist
    if (withBarcodes.length > 0) {
      await this.processBarcodeProducts(withBarcodes);
    }

    console.log('Batch image loading completed');
  }
  /**
   * Efficiently partition products by barcode availability
   */
  private partitionProductsByBarcode(products: any[]): { withBarcodes: any[], withoutBarcodes: any[] } {
    const withBarcodes: any[] = [];
    const withoutBarcodes: any[] = [];
    
    for (const product of products) {
      const barcode = this.extractBarcode(product);
      if (barcode) {
        // Normalize barcode on product for consistency
        product.barcode = barcode;
        withBarcodes.push(product);
      } else {
        withoutBarcodes.push(product);
      }
    }
    
    return { withBarcodes, withoutBarcodes };
  }

  /**
   * Set fallback images for products without barcodes
   */
  private setFallbackImages(products: any[]): void {
    for (const product of products) {
      product.image_url = this.FALLBACK_IMAGE;
    }
  }
  /**
   * Process products with barcodes in optimized batches
   */
  private async processBarcodeProducts(products: any[]): Promise<void> {
    if (!products?.length) return;
    
    const batches = this.chunkArray(products, this.MAX_CONCURRENT_REQUESTS);
    
    for (let i = 0; i < batches.length; i++) {
      await this.processSingleBatch(batches[i], i + 1, batches.length);
      
      // Add delay between batches to respect rate limits (except for last batch)
      if (i < batches.length - 1) {
        await this.delay(this.DELAY_BETWEEN_BATCHES_MS);
      }
    }
  }

  /**
   * Process a single batch of products
   */
  private async processSingleBatch(batch: any[], batchNumber: number, totalBatches: number): Promise<void> {
    const promises = batch.map(product => this.processProductImage(product));
    await Promise.all(promises);
    console.log(`Batch ${batchNumber}/${totalBatches} completed (${batch.length} products)`);
  }

  /**
   * Process image for a single product with error handling
   */
  private async processProductImage(product: any): Promise<void> {
    try {
      product.image_url = await this.getProductImage(product.name, product.barcode);
    } catch (error) {
      console.error(`Error loading image for product ${product.name} (barcode: ${product.barcode}):`, error);
      product.image_url = this.FALLBACK_IMAGE;
    }
  }

  /**
   * Utility method for creating delays
   */  // === UTILITY METHODS ===
  
  /**
   * Generic utility to chunk arrays for batch processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    if (chunkSize <= 0) throw new Error('Chunk size must be positive');
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Promise-based delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Safe barcode extraction from multiple possible fields
   */
  private extractBarcode(item: any): string {
    const barcodeFields = ['barcode', 'product_barcode', 'ean', 'gtin'];
    for (const field of barcodeFields) {
      const value = item[field];
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(timestamp: number, ttlMs: number): boolean {
    return Date.now() - timestamp < ttlMs;
  }

  /**
   * Generic cache key generator
   */
  private generateCacheKey(...parts: (string | number)[]): string {
    return parts.map(p => String(p)).join('_');
  }
  /**
   * Log barcode statistics for debugging
   */
  private logBarcodeStatistics(products: any[], context: string): void {
    const total = products.length;
    const withBarcodes = products.filter(p => this.extractBarcode(p)).length;
    const percentage = total > 0 ? ((withBarcodes / total) * 100).toFixed(1) : '0';
    
    console.log(`${context}: ${withBarcodes}/${total} products have barcodes (${percentage}%)`);
    
    if (withBarcodes < total) {
      const missing = products.filter(p => !this.extractBarcode(p));
      console.warn(`Products missing barcodes in ${context}:`, 
        missing.slice(0, 5).map(p => ({ id: p.id, name: p.name }))
      );
    }
  }

  // === CACHED REGULAR PRODUCTS UTILITIES ===
  
  /**
   * Get cached regular products for a supermarket with TTL check
   */
  private getCachedRegularProducts(supermarketId: number): any[] | null {
    const cached = this.cachedRegularProducts.get(supermarketId);
    if (cached && this.isCacheValid(cached.timestamp, this.REGULAR_PRODUCTS_CACHE_TTL)) {
      return cached.products;
    }
    return null;
  }

  /**
   * Cache regular products for a supermarket
   */
  private setCachedRegularProducts(supermarketId: number, products: any[]): void {
    this.cachedRegularProducts.set(supermarketId, {
      products,
      timestamp: Date.now()
    });
  }

  /**
   * Load regular products with caching support
   */
  private async loadRegularProductsWithCache(supermarketId: number): Promise<any[]> {
    // Check cache first
    const cached = this.getCachedRegularProducts(supermarketId);
    if (cached) {
      console.log(`Using cached regular products for supermarket ${supermarketId}`);
      return cached;
    }

    try {
      const response = await this.http.get<{ products: any[] }>(
        ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      const products = response?.products || [];
      this.setCachedRegularProducts(supermarketId, products);
      console.log(`Cached ${products.length} regular products for supermarket ${supermarketId}`);
      
      return products;
    } catch (error) {
      console.error('Error loading regular products for caching:', error);
      return [];
    }
  }
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
      const category = product.category || 'Altro';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    return Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
      icon: this.getCategoryIcon(name)
    }));
  }

  // === PRODUCT UTILITIES ===
  
  getDisplayPrice(product: any): number {
    return product.on_offer && product.offer_price ? product.offer_price : product.price;
  }

  getOriginalPrice(product: any): number | null {
    return product.on_offer && product.offer_price ? product.price : null;
  }

  filterProductsByCategory(products: any[], categoryName: string): any[] {
    if (categoryName === '') {
      return [...products];
    } else {
      return products.filter(p => {
        const productCategory = p.category || 'Altro';
        return productCategory === categoryName;
      });
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
      
      return response;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // === PRODUCT LOADING UTILITIES ===
  async loadSupermarketProducts(supermarketId: number): Promise<any[]> {
    try {
      const response = await this.http.get<{ products: any[] }>(
        ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      const products = response?.products || [];
      
      // Use batch loading for better rate limit management
      await this.batchLoadProductImages(products);
      
      return products;
    } catch (error) {
      console.error('Error loading products:', error);
      return [];
    }
  }
  // === OFFER PRODUCT UTILITIES ===
  
  /**
   * Map offer data to standardized product format with enhanced barcode extraction
   */
  private mapOfferProducts(offers: any[]): any[] {
    return offers.map((offer: any) => {
      const product = {
        id: offer.product_id,
        name: offer.product_name,
        description: offer.product_description,
        category: offer.category || '',
        price: offer.original_price,
        offer_price: offer.offer_price,
        on_offer: true,
        quantity: 1,
        barcode: this.extractBarcode(offer) // Use utility for robust extraction
      };
      
      return product;
    });
  }

  /**
   * Enhanced offer product enrichment with better error handling and logging
   */
  private async enrichOfferProductsBarcodes(offerProducts: any[], supermarketId: number): Promise<any[]> {
    const missingBarcodes = offerProducts.filter(p => !this.extractBarcode(p));
    
    if (missingBarcodes.length === 0) {
      console.log('All offer products already have barcodes, skipping enrichment');
      return offerProducts;
    }

    console.log(`Enriching ${missingBarcodes.length} offer products with individual API calls...`);
    
    const enrichmentPromises = missingBarcodes.map(async (product) => {
      try {
        const productResponse = await this.http.get<{ product: any }>(
          `${ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString())}/${product.id}`,
          { withCredentials: true }
        ).toPromise();
        
        const barcode = this.extractBarcode(productResponse?.product);
        if (barcode) {
          product.barcode = barcode;
          console.log(`✓ Enriched "${product.name}" with barcode: ${barcode}`);
        } else {
          console.warn(`✗ No barcode found for "${product.name}" (ID: ${product.id})`);
        }
      } catch (error) {
        console.error(`✗ Error enriching "${product.name}":`, error);
      }
      return product;
    });

    await Promise.all(enrichmentPromises);
    
    const finalStats = {
      total: offerProducts.length,
      withBarcodes: offerProducts.filter(p => this.extractBarcode(p)).length
    };
    
    console.log(`Enrichment complete: ${finalStats.withBarcodes}/${finalStats.total} offer products have barcodes`);
    
    return offerProducts;
  }

  /**
   * Match offer products with regular products using multiple strategies
   */
  private async matchOfferProductsWithRegularProducts(offerProducts: any[], supermarketId: number): Promise<any[]> {
    try {
      const regularProducts = await this.loadRegularProductsWithCache(supermarketId);
      
      if (regularProducts.length === 0) {
        console.log('No regular products available for matching');
        return offerProducts;
      }
      
      console.log(`Matching ${offerProducts.length} offers with ${regularProducts.length} regular products...`);
      
      // Create lookup maps for efficient matching
      const regularById = new Map(regularProducts.map(p => [p.id, p]));
      const regularByName = new Map(
        regularProducts.map(p => [p.name?.toLowerCase().trim(), p]).filter(([key]) => key)
      );
      
      let matchedCount = 0;
      
      const matchedProducts = offerProducts.map((offerProduct: any) => {
        if (this.extractBarcode(offerProduct)) {
          return offerProduct; // Already has barcode
        }
        
        // Strategy 1: Match by ID
        let match = regularById.get(offerProduct.id);
        if (!match) {
          // Strategy 2: Match by normalized name
          const normalizedOfferName = offerProduct.name?.toLowerCase().trim();
          if (normalizedOfferName) {
            match = regularByName.get(normalizedOfferName);
          }
        }
        
        if (match) {
          const barcode = this.extractBarcode(match);
          if (barcode) {
            offerProduct.barcode = barcode;
            matchedCount++;
            console.log(`✓ Matched "${offerProduct.name}" with barcode: ${barcode}`);
          }
        }
        
        return offerProduct;
      });
      
      console.log(`Matching complete: ${matchedCount} new barcodes found`);
      this.logBarcodeStatistics(matchedProducts, 'After matching');
      
      return matchedProducts;
    } catch (error) {
      console.error('Error during offer-regular product matching:', error);
      return offerProducts;
    }
  }
    try {
      const response = await this.http.get<any>(
        ApiConfig.ENDPOINTS.OFFERS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      if (response?.data?.offers) {
        console.log(`Loading ${response.data.offers.length} offers for supermarket ${supermarketId}`);
        
        const offerProducts = response.data.offers.map((offer: any) => {
          const product = {
            id: offer.product_id,
            name: offer.product_name,
            description: offer.product_description,
            category: offer.category || '',
            price: offer.original_price,
            offer_price: offer.offer_price,
            on_offer: true,
            quantity: 1,
            barcode: offer.barcode || offer.product_barcode || '' // Try multiple barcode fields
          };
          
          // Log barcode availability for debugging
          if (!product.barcode || product.barcode.trim() === '') {
            console.warn(`Offer product "${product.name}" (ID: ${product.id}) is missing barcode - will use fallback image`);
          } else {
            console.log(`Offer product "${product.name}" has barcode: ${product.barcode}`);
          }
          
          return product;
        });        console.log(`Offer products with barcodes: ${offerProducts.filter((p: any) => p.barcode && p.barcode.trim() !== '').length}/${offerProducts.length}`);

        // If many products are missing barcodes, try to match them with regular products first
        const productsWithoutBarcodes = offerProducts.filter((p: any) => !p.barcode || p.barcode.trim() === '');
        if (productsWithoutBarcodes.length > 0) {
          console.log(`${productsWithoutBarcodes.length} offer products missing barcodes, attempting to match with regular products...`);
          
          // First try: match with regular products (more efficient)
          const matchedProducts = await this.matchOfferProductsWithRegularProducts(offerProducts, supermarketId);
          
          // Second try: individual API calls for remaining products without barcodes (if needed)
          const stillMissingBarcodes = matchedProducts.filter((p: any) => !p.barcode || p.barcode.trim() === '');
          let finalProducts = matchedProducts;
          
          if (stillMissingBarcodes.length > 0 && stillMissingBarcodes.length < matchedProducts.length) {
            console.log(`${stillMissingBarcodes.length} products still missing barcodes, trying individual enrichment...`);
            finalProducts = await this.enrichOfferProductsWithBarcodes(matchedProducts, supermarketId);
          }
          
          // Use batch loading for better rate limit management
          await this.batchLoadProductImages(finalProducts);
          
          return finalProducts;
        }

        // Use batch loading for better rate limit management
        await this.batchLoadProductImages(offerProducts);
        
        return offerProducts;
      }
      return [];
    } catch (error) {
      console.error('Error loading offers:', error);
      return [];
    }
  }

  async loadPurchaseHistory(limit: number = 5): Promise<any[]> {
    try {
      const response = await this.http.get<{ purchases: any[] }>(
        ApiConfig.ENDPOINTS.PURCHASES, 
        { withCredentials: true }
      ).toPromise();
      return response?.purchases?.slice(0, limit) || [];
    } catch (error) {
      console.error('Error loading purchase history:', error);
      return [];
    }
  }

  /**
   * Enriches offer products with barcode information by querying full product details
   */
  private async enrichOfferProductsWithBarcodes(offerProducts: any[], supermarketId: number): Promise<any[]> {
    console.log('Enriching offer products with barcode information...');
    
    // Get full product details for each offer product to obtain barcodes
    const enrichedProducts = await Promise.all(
      offerProducts.map(async (offerProduct) => {
        if (offerProduct.barcode && offerProduct.barcode.trim() !== '') {
          // Already has barcode, no need to enrich
          return offerProduct;
        }
        
        try {
          // Query full product details to get barcode
          const productResponse = await this.http.get<{ product: any }>(
            `${ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString())}/${offerProduct.id}`,
            { withCredentials: true }
          ).toPromise();
          
          if (productResponse?.product?.barcode) {
            offerProduct.barcode = productResponse.product.barcode;
            console.log(`Enriched offer product "${offerProduct.name}" with barcode: ${offerProduct.barcode}`);
          } else {
            console.warn(`Could not find barcode for offer product "${offerProduct.name}" (ID: ${offerProduct.id})`);
          }
        } catch (error) {
          console.error(`Error enriching offer product "${offerProduct.name}":`, error);
        }
        
        return offerProduct;
      })
    );
    
    const enrichedCount = enrichedProducts.filter((p: any) => p.barcode && p.barcode.trim() !== '').length;
    console.log(`Enrichment complete: ${enrichedCount}/${enrichedProducts.length} offer products now have barcodes`);
    
    return enrichedProducts;
  }
  /**
   * Tries to match offer products with regular products to get barcodes
   * This is more efficient than individual API calls
   */
  private async matchOfferProductsWithRegularProducts(offerProducts: any[], supermarketId: number): Promise<any[]> {
    try {
      // Load regular products for the same supermarket
      const regularProductsResponse = await this.http.get<{ products: any[] }>(
        ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString()), 
        { withCredentials: true }
      ).toPromise();
      
      const regularProducts = regularProductsResponse?.products || [];
      if (regularProducts.length === 0) {
        console.log('No regular products found to match with offers');
        return offerProducts;
      }
      
      console.log(`Attempting to match ${offerProducts.length} offer products with ${regularProducts.length} regular products...`);
      
      const matchedProducts = offerProducts.map((offerProduct: any) => {
        if (offerProduct.barcode && offerProduct.barcode.trim() !== '') {
          // Already has barcode
          return offerProduct;
        }
        
        // Try to find matching regular product by ID or name
        const matchingProduct = regularProducts.find((regular: any) => 
          regular.id === offerProduct.id || 
          regular.name?.toLowerCase() === offerProduct.name?.toLowerCase()
        );
        
        if (matchingProduct?.barcode) {
          offerProduct.barcode = matchingProduct.barcode;
          console.log(`Matched offer product "${offerProduct.name}" with barcode: ${offerProduct.barcode}`);
        }
        
        return offerProduct;
      });
      
      const matchedCount = matchedProducts.filter((p: any) => p.barcode && p.barcode.trim() !== '').length;
      console.log(`Matching complete: ${matchedCount}/${matchedProducts.length} offer products now have barcodes`);
      
      return matchedProducts;
    } catch (error) {
      console.error('Error matching offer products with regular products:', error);
      return offerProducts;
    }
  }
}
