import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProdottiService {
  // Product image caching constants
  private readonly PRODUCT_IMAGE_CACHE_KEY = 'productImageCache';
  private readonly CACHE_EXPIRY_DAYS = 7;
  private imageCache: Map<string, { url: string; timestamp: number }> = new Map();

  constructor(private http: HttpClient) {
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
  }

  private rateLimitDelay(): Promise<void> {
    // OpenFoodFacts rate limit: max 100 requests per minute
    return new Promise(resolve => setTimeout(resolve, 650)); // ~90 requests per minute
  }

  async getProductImage(productName: string, barcode?: string): Promise<string> {
    const cacheKey = barcode || productName.toLowerCase();
    
    // Check cache first
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      return cached.url;
    }

    try {
      // Use OpenFoodFacts API with rate limiting
      await this.rateLimitDelay();
      
      let imageUrl = '';
      
      if (barcode) {
        const response = await this.http.get<any>(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`).toPromise();
        if (response?.product?.image_url) {
          imageUrl = response.product.image_url;
        }
      }
      
      if (!imageUrl) {
        // Fallback to search by name
        const searchResponse = await this.http.get<any>(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&action=process&json=1&page_size=1`).toPromise();
        if (searchResponse?.products?.[0]?.image_url) {
          imageUrl = searchResponse.products[0].image_url;
        }
      }
      
      // Cache the result (even if empty)
      const fallbackUrl = imageUrl || 'assets/icon/favicon.png';
      this.imageCache.set(cacheKey, {
        url: fallbackUrl,
        timestamp: Date.now()
      });
      this.saveImageCache();
      
      return fallbackUrl;
    } catch (error) {
      console.error('Error fetching product image:', error);
      const fallbackUrl = 'assets/icon/favicon.png';
      this.imageCache.set(cacheKey, {
        url: fallbackUrl,
        timestamp: Date.now()
      });
      this.saveImageCache();
      return fallbackUrl;
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

  // === PRODUCT LOADING UTILITIES ===
  
  async loadSupermarketProducts(supermarketId: number): Promise<any[]> {
    try {
      const response = await this.http.get<{ products: any[] }>(
        `${environment.apiUrl}/api/supermarkets/${supermarketId}/products`, 
        { withCredentials: true }
      ).toPromise();
      
      const products = response?.products || [];
      
      // Load images for products
      for (const product of products) {
        product.image_url = await this.getProductImage(product.name, product.barcode);
      }
      
      return products;
    } catch (error) {
      console.error('Error loading products:', error);
      return [];
    }
  }

  async loadSupermarketOffers(supermarketId: number): Promise<any[]> {
    try {
      const response = await this.http.get<any>(
        `${environment.apiUrl}/offers/${supermarketId}`, 
        { withCredentials: true }
      ).toPromise();
      
      if (response?.data?.offers) {
        const offerProducts = response.data.offers.map((offer: any) => ({
          id: offer.product_id,
          name: offer.product_name,
          description: offer.product_description,
          category: '',
          price: offer.original_price,
          offer_price: offer.offer_price,
          on_offer: true,
          quantity: 1
        }));

        // Load images for offer products
        for (const product of offerProducts) {
          product.image_url = await this.getProductImage(product.name);
        }
        
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
        `${environment.apiUrl}/api/purchases`, 
        { withCredentials: true }
      ).toPromise();
      return response?.purchases?.slice(0, limit) || [];
    } catch (error) {
      console.error('Error loading purchase history:', error);
      return [];
    }
  }
}
