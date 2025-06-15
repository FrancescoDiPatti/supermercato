import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  supermarketId: number;
  supermarketName: string;
}

@Injectable({
  providedIn: 'root'
})
export class CarrelloService {

  private cartItems = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItems.asObservable();

  constructor() { }

  /**
   * Add product to cart
   */
  addToCart(product: any, supermarket: any): void {
    const currentItems = this.cartItems.value;
    const existingItemIndex = currentItems.findIndex(
      item => item.id === product.id && item.supermarketId === supermarket.id
    );

    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      currentItems[existingItemIndex].quantity += 1;
    } else {
      // Add new item
      const newItem: CartItem = {
        id: product.id,
        name: product.name,
        price: product.on_offer ? product.offer_price || product.price : product.price,
        quantity: 1,
        supermarketId: supermarket.id,
        supermarketName: supermarket.name
      };
      currentItems.push(newItem);
    }

    this.cartItems.next([...currentItems]);
    console.log('Product added to cart:', product.name);
  }

  /**
   * Remove product from cart
   */
  removeFromCart(productId: number, supermarketId: number): void {
    const currentItems = this.cartItems.value.filter(
      item => !(item.id === productId && item.supermarketId === supermarketId)
    );
    this.cartItems.next(currentItems);
  }

  /**
   * Update quantity of item in cart
   */
  updateQuantity(productId: number, supermarketId: number, quantity: number): void {
    const currentItems = this.cartItems.value;
    const itemIndex = currentItems.findIndex(
      item => item.id === productId && item.supermarketId === supermarketId
    );

    if (itemIndex >= 0) {
      if (quantity <= 0) {
        this.removeFromCart(productId, supermarketId);
      } else {
        currentItems[itemIndex].quantity = quantity;
        this.cartItems.next([...currentItems]);
      }
    }
  }

  /**
   * Get current cart items
   */
  getCartItems(): CartItem[] {
    return this.cartItems.value;
  }

  /**
   * Get total cart value
   */
  getCartTotal(): number {
    return this.cartItems.value.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  /**
   * Get total items count
   */
  getCartItemsCount(): number {
    return this.cartItems.value.reduce((count, item) => count + item.quantity, 0);
  }  /**
   * Clear cart
   */
  clearCart(): void {
    this.cartItems.next([]);
  }
}
