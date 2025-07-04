import { environment } from '../../environments/environment';

export class ApiConfig {
  static readonly BASE_URL = environment.apiUrl;
  static readonly API_URL = `${environment.apiUrl}/api`;

  static readonly ENDPOINTS = {
    AUTH: {
      LOGIN: `${this.API_URL}/login`,
      REGISTER: `${this.API_URL}/register`
    },
    SUPERMARKETS: {
      LIST: `${this.API_URL}/supermarkets`,
      BY_ID: (id: string) => `${this.API_URL}/supermarkets/${id}`,
      ADD: `${this.API_URL}/add_supermarket`,
      PRODUCTS: (id: string) => `${this.API_URL}/supermarkets/${id}/products`,
      ADD_PRODUCTS_TO_SUPERMARKET: (id: string) => `${this.BASE_URL}/add_product_to_supermarket/${id}`
    },
    PRODUCTS: {
      ADD: `${this.API_URL}/add_product`
    },
    OFFERS: (supermarketId: string) => `${this.BASE_URL}/offers/${supermarketId}`,
    PURCHASES: `${this.API_URL}/purchases`,
    PURCHASE: (supermarketId: string, productId: string) => `${this.BASE_URL}/purchase/${supermarketId}/${productId}`,
    DASHBOARD: `${this.BASE_URL}/dashboard`
  };

  static getApiUrl(): string {
    return this.API_URL;
  }
}