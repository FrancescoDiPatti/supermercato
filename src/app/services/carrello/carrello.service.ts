import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { ApiConfig } from '../../config/api.config';

export interface CartItem {
  id: number; // product id
  barcode: string;
  name: string;
  description: string;
  price: number; // This will be the effective price (offer_price if on offer, else regular price)
  originalPrice?: number; // The original price before offer
  onOffer: boolean; // Whether this item is on offer
  quantity: number;
  supermarketId: number;
  supermarketName: string;
}

export interface PurchaseRequest {
  quantity: number;
}

export interface PurchaseResponse {
  message: string;
  data: {
    product_id: number;
    product_name: string;
    quantity: number;
    price_per_unit: number;
    total_price: number;
    on_offer: boolean;
  };
}

export interface PurchaseError {
  error: string;
  message: string;
  available_quantity?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CarrelloService {
  private readonly storageKey = 'cartItems';
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItems.asObservable();

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true
  };

  constructor(private http: HttpClient) {
    this.loadCartFromSession();
  }

  private loadCartFromSession(): void {
    const items = sessionStorage.getItem(this.storageKey);
    if (items) {
      this.cartItems.next(JSON.parse(items));
    }
  }

  private saveCartToSession(): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify(this.cartItems.value));
  }

  removeFromCart(productId: number, supermarketId: number): void {
    const currentItems = this.cartItems.value.filter(
      item => !(item.id === productId && item.supermarketId === supermarketId)
    );
    this.cartItems.next(currentItems);
    this.saveCartToSession();
  }

  updateCartItem(product: any, supermarket: any, quantity: number): void {
    const currentItems = [...this.cartItems.value];
    const itemIndex = currentItems.findIndex(
      item => item.id === product.id && item.supermarketId === supermarket.id
    );

    if (quantity <= 0) {
      if (itemIndex >= 0) {
        // Rimuove l'articolo se la quantità è 0 o meno
        currentItems.splice(itemIndex, 1);
        this.cartItems.next(currentItems);
        this.saveCartToSession();
      }
      return; 
    }

    if (itemIndex >= 0) {
      // Aggiorna la quantità se l'articolo esiste già
      currentItems[itemIndex].quantity = quantity;
    } else {
      // Determine if the product is on offer and calculate prices
      const isOnOffer = product.on_offer && product.offer_price !== undefined && product.offer_price < product.price;
      const effectivePrice = isOnOffer ? product.offer_price : product.price;
      const originalPrice = isOnOffer ? product.price : undefined;

      // Aggiunge un nuovo articolo se non esiste
      const newItem: CartItem = {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        description: product.description || '',
        price: effectivePrice,
        originalPrice: originalPrice,
        onOffer: isOnOffer,
        quantity: quantity,
        supermarketId: supermarket.id,
        supermarketName: supermarket.name
      };
      currentItems.push(newItem);
    }

    this.cartItems.next(currentItems);
    this.saveCartToSession();
  }

  getCartItems(): CartItem[] {
    return this.cartItems.value;
  }

  getCartTotal(): number {
    return this.cartItems.value.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  getCartItemsCount(): number {
    return this.cartItems.value.reduce((count, item) => count + item.quantity, 0);
  }

  clearCart(): void {
    this.cartItems.next([]);
    this.saveCartToSession();
  }

  // === PURCHASE FUNCTIONALITY ===
  
  /**
   * Effettua l'acquisto di un singolo prodotto
   */
  purchaseProduct(supermarketId: number, productId: number, quantity: number): Observable<PurchaseResponse> {
    const url = ApiConfig.ENDPOINTS.PURCHASE(supermarketId.toString(), productId.toString());
    const body: PurchaseRequest = { quantity };
    
    return this.http.post<PurchaseResponse>(url, body, this.httpOptions);
  }

  /**
   * Effettua l'acquisto di più prodotti (carrello completo)
   */
  purchaseCart(cartItems: CartItem[], quantities: { [barcode: string]: number }): Observable<PurchaseResponse[]> {
    const purchaseRequests: Observable<PurchaseResponse>[] = [];
    
    cartItems.forEach(item => {
      const quantity = quantities[item.barcode];
      if (quantity && quantity > 0) {
        purchaseRequests.push(
          this.purchaseProduct(item.supermarketId, item.id, quantity)
        );
      }
    });

    return forkJoin(purchaseRequests);
  }
}
