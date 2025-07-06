import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonButton, IonIcon, IonFabButton, IonImg,
  IonItem, IonItemSliding,
  IonBadge
} from '@ionic/angular/standalone';
import { HomeService } from '../../services/home/home.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  cart, add, remove, trash, storefront, checkmarkCircle,
  arrowBack, cartOutline, close, alertCircle, basketOutline,
  trashOutline, checkmarkCircleOutline, receiptOutline,
  cubeOutline, cardOutline, addCircleOutline, storefrontOutline, 
  basket, pricetagOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-carrello',
  templateUrl: './carrello.page.html',
  styleUrls: ['./carrello.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonButton, IonIcon, IonFabButton, IonImg,
    IonItem, IonItemSliding, IonBadge,
    CommonModule, FormsModule
  ]
})
export class CarrelloPage implements OnInit, OnDestroy {
  // Cart data
  public cartItems: any[] = [];
  public groupedItems: Array<{key: string, value: any[], name: string, id: number}> = [];
  public quantities: { [barcode: string]: number } = {};
  public availableQuantities: { [barcode: string]: number } = {};
  
  // UI state
  public isToastOpen: boolean = false;
  public toastMessage: string = '';
  public isAlertOpen: boolean = false;
  public alertMessage: string = '';
  public alertButtons: any[] = [];
  public showCustomAlert: boolean = false;
  public alertType: 'success' | 'error' = 'success';
  public alertTitle: string = '';
  public alertMessageCustom: string = '';
  public isProcessingPayment: boolean = false;
  public isCompletingPurchase: boolean = false;
  
  // Private properties
  private cartSubscription?: Subscription;
  private imageCache: {[key: string]: string} = {};

  constructor(
    private readonly homeService: HomeService,
    private readonly router: Router
  ) {
    addIcons({ 
      cart, add, remove, trash, storefront, checkmarkCircle, 
      arrowBack, cartOutline, close, alertCircle, basketOutline, 
      trashOutline, checkmarkCircleOutline, receiptOutline, 
      cubeOutline, cardOutline, addCircleOutline, storefrontOutline, 
      basket, pricetagOutline
    });
  }

  // User role getters
  public get isAdmin(): boolean {
    return this.homeService.isUserAdmin();
  }

  public get isManager(): boolean {
    return this.homeService.isUserManager();
  }

  public get isCustomer(): boolean {
    const user = this.homeService.getCurrentUser();
    return user?.role === 'customer';
  }

  // Initialize component
  ngOnInit(): void {
    this.cartSubscription = this.homeService.cart.cartItems$.subscribe(items => {
      this.cartItems = items || [];
      this.loadQuantitiesFromCart();
      this.loadAvailableQuantities();
      this.updateGroupedItems();
    });
  }

  // Clean up component
  ngOnDestroy(): void {
    this.homeService.ui.clearTimer();
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  // Load quantities from cart items
  private loadQuantitiesFromCart(): void {
    this.quantities = {};
    this.cartItems.forEach(item => {
      if (item && item.barcode) {
        this.quantities[item.barcode] = item.quantity;
      }
    });
  }

  // Load available quantities from supermarkets
  private loadAvailableQuantities(): void {
    this.availableQuantities = {};
    const supermarketIds = [...new Set(this.cartItems.map(item => item.supermarketId))];
    
    supermarketIds.forEach(supermarketId => {
      const supermarketQuantities = this.homeService.ui.getAvailableQuantities(supermarketId);
      Object.assign(this.availableQuantities, supermarketQuantities);
    });
  }

  // Update grouped items by supermarket
  private updateGroupedItems(): void {
    if (!this.cartItems || this.cartItems.length === 0) {
      this.groupedItems = [];
      return;
    }
    
    const grouped: { [key: string]: any[] } = {};
    this.cartItems.forEach(item => {
      if (item && item.supermarketId && item.supermarketName) {
        const key = `${item.supermarketId}-${item.supermarketName}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(item);
      }
    });
    this.groupedItems = Object.keys(grouped).map(key => ({
      key,
      value: grouped[key],
      name: grouped[key][0]?.supermarketName || 'Supermercato sconosciuto',
      id: grouped[key][0]?.supermarketId || 0
    }));
  }

  // Quantity management with multipliers
  handleQuantityClick(barcode: string, amount: number, event: MouseEvent): void {
    event.preventDefault();
    this.updateQuantity(barcode, amount);
  }

  // Increment quantity by 1
  incrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, 1); 
  }
  
  // Decrement quantity by 1
  decrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, -1); 
  }
  
  // Start increment timer on button press
  onIncrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  // Start decrement timer on button press
  onDecrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, false, this.updateQuantity.bind(this));
  }
  
  // Stop timer on button release
  onButtonRelease(): void { 
    this.homeService.ui.clearTimer();
  }

  // Update product quantity with availability check
  private updateQuantity(barcode: string, amount: number): void {
    const result = this.homeService.ui.updateQuantity(
      this.quantities, 
      barcode, 
      amount, 
      this.availableQuantities
    );
    this.quantities = result.quantities;
    
    const cartItem = this.findCartItemByBarcode(barcode);
    if (cartItem) {
      const product = this.buildProductFromCartItem(cartItem);
      const supermarket = this.buildSupermarketFromCartItem(cartItem);
      const newQuantity = result.quantities[barcode] || 0;
      
      this.homeService.cart.updateCartItem(product, supermarket, newQuantity);
    }
  }
  
  // Build product object from cart item
  private buildProductFromCartItem(cartItem: any): any {
    return {
      id: cartItem.id,
      barcode: cartItem.barcode,
      name: cartItem.name,
      description: cartItem.description,
      price: cartItem.originalPrice || cartItem.price,
      offer_price: cartItem.onOffer ? cartItem.price : undefined,
      on_offer: cartItem.onOffer
    };
  }
  
  // Build supermarket object from cart
  private buildSupermarketFromCartItem(cartItem: any): any {
    return {
      id: cartItem.supermarketId,
      name: cartItem.supermarketName
    };
  }
  
  // Find cart item by barcode
  private findCartItemByBarcode(barcode: string): any | undefined {
    return this.cartItems.find(item => item.barcode === barcode);
  }

  // Show confirmation alert
  private showConfirmationAlert(message: string, onConfirm: () => void): void {
    this.alertMessage = message;
    this.alertButtons = [
      {
        text: 'Annulla',
        role: 'cancel'
      },
      {
        text: 'Conferma',
        role: 'destructive',
        handler: onConfirm
      }
    ];
    this.isAlertOpen = true;
  }

  // Cart calculation methods
  getCartTotal(): number {
    return this.homeService.cart.getCartTotal();
  }

  getCartItemsCount(): number {
    return this.homeService.cart.getCartItemsCount();
  }

  getTotalSavings(): number {
    return this.cartItems.reduce((savings, item) => {
      if (item.onOffer && item.originalPrice) {
        const itemSaving = (item.originalPrice - item.price) * item.quantity;
        return savings + itemSaving;
      }
      return savings;
    }, 0);
  }

  getSupermercatoTotal(items: any[]): number {
    if (!items || items.length === 0) {
      return 0;
    }
    return items.reduce((total, item) => {
      if (item && item.barcode && typeof item.price === 'number') {
        const quantity = this.quantities[item.barcode] || 0;
        return total + (item.price * quantity);
      }
      return total;
    }, 0);
  }

  // Checkout process
  proceedToCheckout(): void {
    if (!this.validateCartForCheckout()) {
      return;
    }

    const itemsWithQuantity = this.getItemsWithQuantity();
    if (itemsWithQuantity.length === 0) {
      this.showAlert('error', 'Nessun prodotto selezionato', 'Seleziona almeno un prodotto per procedere');
      return;
    }

    this.processPayment(itemsWithQuantity);
  }

  // Validate cart before checkout
  private validateCartForCheckout(): boolean {
    if (this.cartItems.length === 0) {
      this.showAlert('error', 'Carrello vuoto', 'Aggiungi alcuni prodotti prima di procedere al pagamento');
      return false;
    }
    return true;
  }

  // Get items with valid quantity
  private getItemsWithQuantity(): any[] {
    return this.cartItems.filter(item => 
      this.quantities[item.barcode] && this.quantities[item.barcode] > 0
    );
  }

  // Process payment
  private processPayment(itemsWithQuantity: any[]): void {
    this.isProcessingPayment = true;
    this.showAlert('success', 'Elaborazione in corso...', 'Il tuo ordine è in preparazione, attendere...');

    this.homeService.cart.purchaseCart(itemsWithQuantity, this.quantities).subscribe({
      next: (responses: any[]) => {
        this.isProcessingPayment = false;
        this.handlePurchaseSuccess(responses);
      },
      error: (error: any) => {
        this.isProcessingPayment = false;
        this.handlePurchaseError(error);
      }
    });
  }

  // Handle successful purchase
  private handlePurchaseSuccess(responses: any[]): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
      this.cartSubscription = undefined;
    }

    const totalQuantity = responses.reduce((sum, response) => sum + response.data.quantity, 0);
    const totalAmount = responses.reduce((sum, response) => sum + response.data.total_price, 0);
    
    this.showAlert(
      'success', 
      'Acquisto completato!', 
      `Hai acquistato un totale di ${totalQuantity} prodott${totalQuantity === 1 ? 'o' : 'i'} per un totale di €${totalAmount.toFixed(2)}`
    );
    setTimeout(() => {
      this.isCompletingPurchase = false;
      this.homeService.cart.clearCart();
      this.router.navigate(['/home/ordini']);
    }, 3000);
  }

  // Handle purchase errors
  private handlePurchaseError(error: any): void {
    console.error('Purchase error:', error);
    
    const errorInfo = this.parseErrorResponse(error);
    this.showAlert('error', errorInfo.title, errorInfo.message);
  }

  // Error response info
  private parseErrorResponse(error: any): {title: string, message: string} {
    let errorMessage = 'Si è verificato un errore durante l\'acquisto';
    let errorTitle = 'Errore';

    if (error.error) {
      if (error.error.message) {
        errorMessage = error.error.message;
      }
      switch (error.status) {
        case 401:
          errorTitle = 'Accesso negato';
          errorMessage = 'Devi effettuare il login per completare l\'acquisto';
          break;
        case 400:
          errorTitle = 'Dati non validi';
          if (error.error.available_quantity !== undefined) {
            errorMessage = `Quantità non disponibile. Disponibili: ${error.error.available_quantity}`;
          }
          break;
        case 404:
          errorTitle = 'Prodotto non trovato';
          errorMessage = 'Uno o più prodotti nel carrello non sono più disponibili';
          break;
      }
    }

    return { title: errorTitle, message: errorMessage };
  }

  // Tracking functions for ngFor
  trackByGroup(index: number, group: {key: string, value: any[], name: string, id: number}): string {
    return group ? group.key : index.toString();
  }

  trackByItem(index: number, item: any): string {
    return item ? `${item.id}-${item.supermarketId}` : index.toString();
  }

  // Product image management
  getProductImage(barcode: string): string {
    if (!barcode) return 'assets/categories/packing.png';
    
    if (this.imageCache[barcode]) {
      return this.imageCache[barcode];
    }
    
    try {
      const cachedImage = this.getCachedImage(barcode);
      if (cachedImage) {
        this.imageCache[barcode] = cachedImage;
        return this.imageCache[barcode];
      }
    } catch (error) {
      console.error('Error getting product image:', error);
    }
    
    this.imageCache[barcode] = 'assets/categories/packing.png';
    return this.imageCache[barcode];
  }

  // Get cached image from localStorage
  private getCachedImage(barcode: string): string | null {
    const imageCache = localStorage.getItem('productImageCache');
    if (imageCache) {
      const cache = JSON.parse(imageCache);
      if (cache[barcode]?.url) {
        return cache[barcode].url;
      }
    }
    
    const productData = localStorage.getItem(`product_${barcode}`);
    if (productData) {
      const product = JSON.parse(productData);
      return product.image_url || product.url || null;
    }
    
    return null;
  }

  // Handle image loading errors
  handleImageError(event: any, productName: string): void {
    if (event.target) {
      event.target.src = 'assets/categories/packing.png';
    }
  }

  // Custom alert management
  get alertIcon(): string {
    return this.alertType === 'success' ? 'checkmark-circle' : 'alert-circle';
  }

  // Show custom alert
  showAlert(type: 'success' | 'error', title: string, message: string): void {
    this.alertType = type;
    this.alertTitle = title;
    this.alertMessageCustom = message;
    this.showCustomAlert = true;
  }

  // Close custom alert
  closeAlert(): void {
    if (this.isCompletingPurchase) {
      return;
    }
    this.showCustomAlert = false;
  }

  // Navigation
  continueShopping(): void {
    this.router.navigate(['/home/dashboard']);
  }
}
