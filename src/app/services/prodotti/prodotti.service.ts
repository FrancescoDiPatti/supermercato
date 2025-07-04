import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from '../../config/api.config';
import { OpenFoodFactsService, OpenFoodFactsProduct, OpenFoodFactsSearchResponse } from '../openfoodfacts/openfoodfacts.service';

// Constants

const PRODUCT_IMAGE_CACHE_KEY = 'productImageCache';
const CACHE_EXPIRY_DAYS = 7;
const BATCH_SIZE = 5;
const BATCH_DELAY = 3000;

const DEFAULT_BATCH_CONFIG = {
  BARCODE_BATCH_SIZE: BATCH_SIZE * 4,
  NAME_BATCH_SIZE: BATCH_SIZE,
  BARCODE_DELAY: BATCH_DELAY / 2,
  NAME_DELAY: BATCH_DELAY
} as const;

const DEFAULT_FALLBACK_IMAGE = 'assets/categories/packing.png';

const CATEGORY_ICONS = {
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
} as const;

const CATEGORY_IMAGE_MAP = {
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
} as const;

@Injectable({
  providedIn: 'root'
})
export class ProdottiService {
  private imageCache: Map<string, { url: string; timestamp: number }> = new Map();
  constructor(
    private http: HttpClient,
    private openFoodFactsService: OpenFoodFactsService
  ) {
    this.loadImageCache();
  }
  
  // PUBLIC METHODS

  // Generate offers
  generateOffers(supermarketId: number) {
    return this.http.post(`${ApiConfig.BASE_URL}/generate_offers/${supermarketId}`, {});
  }

  // Get category icon
  getCategoryIcon(category: string): string {
    return CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || CATEGORY_ICONS.Altro;
  }

  // Generate categories from products
  generateCategories(products: any[]): Array<{ name: string; icon: string; count: number }> {
    const categoryMap = new Map<string, number>();
    products.forEach(product => {
      let category = 'Altro';
      if (product.category) {
        category = product.category;
      } else if (product.product_category) {
        category = product.product_category;
      } else if (product.offers && Array.isArray(product.offers)) {
        product.offers.forEach((offer: any) => {
          const offerCategory = offer.product_category || 'Altro';
          categoryMap.set(offerCategory, (categoryMap.get(offerCategory) || 0) + 1);
        });
        return;
      }
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    return Array.from(categoryMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({
        name,
        count,
        icon: this.getCategoryIcon(name)
      }));
  }

  // Get display price
  getDisplayPrice(product: any): number {
    return product.on_offer && product.offer_price ? product.offer_price : product.price;
  }

  // Get original price
  getOriginalPrice(product: any): number | null {
    return product.on_offer && product.offer_price ? product.price : null;
  }

  // Filter products by category
  filterProductsByCategory(products: any[], categoryName: string): any[] {
    if (!categoryName || categoryName === '') {
      return [...products];
    }
    return products.filter(product => {
      let productCategory = 'Altro';
      if (product.category) {
        productCategory = product.category;
      } else if (product.product_category) {
        productCategory = product.product_category;
      } else if (product.offers && Array.isArray(product.offers)) {
        return product.offers.some((offer: any) => {
          const offerCategory = offer.product_category || 'Altro';
          return offerCategory === categoryName;
        });
      }
      return productCategory === categoryName;
    });
  }

  // Load dashboard products
  async loadDashboardProducts(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(
          ApiConfig.ENDPOINTS.DASHBOARD,
          { withCredentials: true }
        )
      );
      const products = response?.data?.products || [];

      if (products.length > 0) {
        this.cleanAndValidateBarcodes(products);
        await this.loadProductImagesInBatches(products);
        this.assignDefaultImages(products);
      }
      return products;
    } catch (error) {
      console.error('Error loading dashboard products:', error);
      return [];
    }
  }

  // Create product
  async createProduct(product: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          ApiConfig.ENDPOINTS.PRODUCTS.ADD,
          product,
          { withCredentials: true }
        )
      );
      return response;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Load supermarket products with optional image
  async loadSupermarketProducts(supermarketId: number, includeImages: boolean = true): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(
          ApiConfig.ENDPOINTS.SUPERMARKETS.PRODUCTS(supermarketId.toString()), 
          { withCredentials: true }
        )
      );
      const products = response.products || [];
      
      if (products.length > 0) {
        this.cleanAndValidateBarcodes(products);
        
        if (includeImages) {
          await this.loadProductImagesInBatches(products);
          this.assignDefaultImages(products);
        }
      }
      return products;
    } catch (error) {
      console.error('Error loading supermarket products:', error);
      return [];
    }
  }

  // Load supermarket offers with optional image
  async loadSupermarketOffers(supermarketId: number, includeImages: boolean = true): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(
          ApiConfig.ENDPOINTS.OFFERS(supermarketId.toString()), 
          { withCredentials: true }
        )
      );
      
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
      const bestOffers = this.selectBestOffers(allOffers);
      
      if (includeImages && bestOffers.length > 0) {
        await this.loadProductImagesInBatches(bestOffers);
        this.assignDefaultImages(bestOffers);
      }
      return bestOffers;
    } catch (error) {
      console.error('Error loading offers:', error);
      return [];
    }
  }

  // Load purchase history
  async loadPurchaseHistory(limit: number = 5): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ purchases: any[] }>(
          ApiConfig.ENDPOINTS.PURCHASES, 
          { withCredentials: true }
        )
      );
      return response?.purchases?.slice(0, limit) || [];
    } catch (error) {
      console.error('Error loading purchase history:', error);
      return [];
    }
  }

  // Get product image with rate limit
  async getProductImage(productName: string, barcode?: string): Promise<string> {
    const cacheKey = barcode || productName.toLowerCase();
    
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      return cached.url;
    }
    let imageUrl = '';
    try {
      if (barcode && barcode.trim()) {
        if (this.openFoodFactsService.canSearchByBarcode()) {
          const productResult: { product?: OpenFoodFactsProduct; status: number; status_verbose: string } = await firstValueFrom(
            this.openFoodFactsService.getProductByBarcode(barcode.trim())
          );
          if (productResult?.product) {
            imageUrl = this.openFoodFactsService.getBestImageUrl(productResult.product) || '';
          }
        }
      }

      if (!imageUrl) {
        if (this.openFoodFactsService.canSearchByName()) {
          const searchResult: OpenFoodFactsSearchResponse = await firstValueFrom(
            this.openFoodFactsService.searchProducts(productName, 1, 1)
          );
          if (searchResult?.products?.[0]) {
            imageUrl = this.openFoodFactsService.getBestImageUrl(searchResult.products[0]) || '';
          }
        }
      }
      
    } catch (error) {
      console.error('Error retrieving product image:', error);
    }
    const fallbackUrl = imageUrl || DEFAULT_FALLBACK_IMAGE;
    this.imageCache.set(cacheKey, {
      url: fallbackUrl,
      timestamp: Date.now()
    });
    this.saveImageCache();
    return fallbackUrl;
  }

  // Load images for loaded products
  async loadImagesForLoadedProducts(allProducts: any[]): Promise<void> {
    if (allProducts.length === 0) return;
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
    const barcodeKeys = uniqueKeys.filter(key => {
      const products = uniqueMap.get(key)!;
      return products[0].barcode && products[0].barcode.trim();
    });
    const nameKeys = uniqueKeys.filter(key => {
      const products = uniqueMap.get(key)!;
      return !products[0].barcode || !products[0].barcode.trim();
    });
    await this.processUniqueKeys(barcodeKeys, uniqueMap, 'barcode');
    await this.processUniqueKeys(nameKeys, uniqueMap, 'name');
    this.assignDefaultImages(allProducts);
  }

  // PRIVATE METHODS

  // Load image cache from localStorage
  private loadImageCache(): void {
    const cached = localStorage.getItem(PRODUCT_IMAGE_CACHE_KEY);
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        this.imageCache = new Map();
        for (const [key, value] of Object.entries(cacheData)) {
          this.imageCache.set(key, value as { url: string; timestamp: number });
        }
        this.cleanExpiredCache();
      } catch (error) {
      }
    }
  }

  // Save image cache to localStorage
  private saveImageCache(): void {
    const cacheObj: { [key: string]: { url: string; timestamp: number } } = {};
    this.imageCache.forEach((value, key) => {
      cacheObj[key] = value;
    });
    localStorage.setItem(PRODUCT_IMAGE_CACHE_KEY, JSON.stringify(cacheObj));
  }

  // Clean expired cache entries
  private cleanExpiredCache(): void {
    const now = Date.now();
    const expiry = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    for (const [key, value] of this.imageCache.entries()) {
      if (now - value.timestamp > expiry) {
        this.imageCache.delete(key);
      }
    }
    this.saveImageCache();
  }

  // Calculate discount percentage
  private calculateDiscountPercentage(originalPrice: number | string, offerPrice: number | string): number {
    const original = typeof originalPrice === 'string' ? parseFloat(originalPrice) || 0 : originalPrice || 0;
    const offer = typeof offerPrice === 'string' ? parseFloat(offerPrice) || 0 : offerPrice || 0;
    if (original <= 0 || offer >= original) {
      return 0;
    }
    const discount = ((original - offer) / original) * 100;
    return Math.round(discount * 10) / 10;
  }

  // Select best offers for product
  private selectBestOffers(allOffers: any[]): any[] {
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
  }

  // Bulk load product images
  private async loadProductImagesInBatches(products: any[]): Promise<void> {
    await this.loadImagesForLoadedProducts(products);
  }

  // Process unique keys
  private async processUniqueKeys(
    keys: string[], 
    uniqueMap: Map<string, any[]>, 
    searchType: 'barcode' | 'name'
  ): Promise<void> {
    if (keys.length === 0) return;
    const batchSize = searchType === 'barcode' ? DEFAULT_BATCH_CONFIG.BARCODE_BATCH_SIZE : DEFAULT_BATCH_CONFIG.NAME_BATCH_SIZE;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batchKeys = keys.slice(i, i + batchSize);
      const canProcessBatch = searchType === 'barcode' 
        ? this.openFoodFactsService.canSearchByBarcode()
        : this.openFoodFactsService.canSearchByName();

      if (!canProcessBatch) {
        batchKeys.forEach(key => {
          const productsWithSameKey = uniqueMap.get(key)!;
          productsWithSameKey.forEach(product => {
            product.image_url = DEFAULT_FALLBACK_IMAGE;
          });
        });
        continue;
      }
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
          productsWithSameKey.forEach(product => {
            product.image_url = imageUrl;
          });
        } catch (error) {
          productsWithSameKey.forEach(product => {
            product.image_url = DEFAULT_FALLBACK_IMAGE;
          });
        }
      });
      await Promise.all(promises);
      if (i + batchSize < keys.length) {
        const delay = searchType === 'barcode' ? DEFAULT_BATCH_CONFIG.BARCODE_DELAY : DEFAULT_BATCH_CONFIG.NAME_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Assign default images based on category
  private assignDefaultImages(products: any[]): void {
    products.forEach(product => {
      if (!product.image_url || product.image_url === DEFAULT_FALLBACK_IMAGE) {
        const category = product.category?.toLowerCase() || '';
        const categoryImage = Object.keys(CATEGORY_IMAGE_MAP).find(key => 
          category.includes(key)
        );
        
        if (categoryImage) {
          product.image_url = CATEGORY_IMAGE_MAP[categoryImage as keyof typeof CATEGORY_IMAGE_MAP];
        } else {
          product.image_url = DEFAULT_FALLBACK_IMAGE;
        }
      }
    });
  }

  // Clean and validate barcodes
  private cleanAndValidateBarcodes(products: any[]): void {
    products.forEach(product => {
      if (product.barcode) {
        if (!product.barcode || typeof product.barcode !== 'string') {
          product.barcode = null;
          return;
        }
        const cleanBarcode = product.barcode.replace(/[\s-]/g, '');
        const isNumericOnly = /^\d+$/.test(cleanBarcode);
        const hasValidLength = cleanBarcode.length >= 8 && cleanBarcode.length <= 14;
        
        if (isNumericOnly && hasValidLength) {
          product.barcode = cleanBarcode;
        } else {
          product.barcode = null;
        }
      }
    });
  }
}
