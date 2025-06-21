import { environment } from '../../environments/environment';

export class ApiConfig {
  static readonly BASE_URLS = environment.apiUrls;
  static readonly PRIMARY_BASE_URL = environment.apiUrls[0];
  static readonly PRIMARY_API_URL = `${environment.apiUrls[0]}/api`;
  
  static readonly API_URLS = environment.apiUrls.map(url => `${url}/api`);

  static readonly ENDPOINTS = {
    AUTH: {
      LOGIN: `${this.PRIMARY_API_URL}/login`,
      REGISTER: `${this.PRIMARY_API_URL}/register`,
      LOGIN_URLS: this.API_URLS.map(url => `${url}/login`),
      REGISTER_URLS: this.API_URLS.map(url => `${url}/register`)
    },
    SUPERMARKETS: {
      LIST: `${this.PRIMARY_API_URL}/supermarkets`,
      BY_ID: (id: string) => `${this.PRIMARY_API_URL}/supermarkets/${id}`,
      ADD: `${this.PRIMARY_API_URL}/add_supermarket`,
      PRODUCTS: (id: string) => `${this.PRIMARY_API_URL}/supermarkets/${id}/products`
    },
    PRODUCTS: {
      ADD: `${this.PRIMARY_API_URL}/add_product`
    },
    OFFERS: (supermarketId: string) => `${this.PRIMARY_BASE_URL}/offers/${supermarketId}`,
    PURCHASES: `${this.PRIMARY_API_URL}/purchases`,
    DASHBOARD: `${this.PRIMARY_BASE_URL}/dashboard`
  };

  static getPrimaryApiUrl(): string {
    return this.PRIMARY_API_URL;
  }
  static getAllApiUrls(): string[] {
    return this.API_URLS;
  }
}