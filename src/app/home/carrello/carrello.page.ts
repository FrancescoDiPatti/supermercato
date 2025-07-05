import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonButton,
  IonIcon,
  IonFabButton,
  IonImg,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonBadge
} from '@ionic/angular/standalone';
import { HomeService } from '../../services/home/home.service';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  cart, 
  add, 
  remove, 
  trash, 
  storefront, 
  checkmarkCircle,
  arrowBack,
  cartOutline,
  close,
  alertCircle,
  basketOutline,
  trashOutline,
  checkmarkCircleOutline,
  receiptOutline,
  cubeOutline,
  cardOutline,
  addCircleOutline,
  storefrontOutline,
  basket,
  pricetagOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-carrello',
  templateUrl: './carrello.page.html',
  styleUrls: ['./carrello.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonButton,
    IonIcon,
    IonFabButton,
    IonImg,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonBadge,
    CommonModule, 
    FormsModule
  ]
})
export class CarrelloPage implements OnInit, OnDestroy {
  cartItems: any[] = [];
  groupedItems: Array<{key: string, value: any[], name: string, id: number}> = [];
  quantities: { [barcode: string]: number } = {};
  availableQuantities: { [barcode: string]: number } = {};
  private cartSubscription?: Subscription;
  isToastOpen = false;
  toastMessage = '';
  isAlertOpen = false;
  alertMessage = '';
  alertButtons: any[] = [];

  // Alert properties
  showCustomAlert = false;
  alertType: 'success' | 'error' = 'success';
  alertTitle = '';
  alertMessageCustom = '';
  isProcessingPayment = false;
  
  // Cache per le immagini già caricate
  private imageCache: {[key: string]: string} = {};

  constructor(
    private homeService: HomeService,
    private router: Router
  ) {
    addIcons({ 
      cart, 
      add, 
      remove, 
      trash, 
      storefront, 
      checkmarkCircle, 
      arrowBack, 
      cartOutline, 
      close, 
      alertCircle, 
      basketOutline, 
      trashOutline,
      checkmarkCircleOutline,
      receiptOutline,
      cubeOutline,
      cardOutline,
      addCircleOutline,
      storefrontOutline,
      basket,
      pricetagOutline
    });
  }

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

  ngOnInit() {
    this.cartSubscription = this.homeService.cart.cartItems$.subscribe(items => {
      this.cartItems = items || [];
      this.loadQuantitiesFromCart();
      this.loadAvailableQuantities();
      this.updateGroupedItems();
    });
  }

  private loadQuantitiesFromCart(): void {
    this.quantities = {};
    this.cartItems.forEach(item => {
      if (item && item.barcode) {
        this.quantities[item.barcode] = item.quantity;
      }
    });
  }

  private loadAvailableQuantities(): void {
    this.availableQuantities = {};
    const supermarketIds = [...new Set(this.cartItems.map(item => item.supermarketId))];
    
    supermarketIds.forEach(supermarketId => {
      const supermarketQuantities = this.homeService.ui.getAvailableQuantities(supermarketId);
      Object.assign(this.availableQuantities, supermarketQuantities);
    });
  }

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
    
    // Convert to array format for easier template usage
    this.groupedItems = Object.keys(grouped).map(key => ({
      key,
      value: grouped[key],
      name: grouped[key][0]?.supermarketName || 'Supermercato sconosciuto',
      id: grouped[key][0]?.supermarketId || 0
    }));
  }

  ngOnDestroy() {
    // Pulisce i timer attivi prima di distruggere il componente
    this.homeService.ui.clearTimer();
    
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  // Gestione quantità con moltiplicatori intelligenti
  handleQuantityClick(barcode: string, amount: number, event: MouseEvent) {
    event.preventDefault();
    this.updateQuantity(barcode, amount);
  }

  incrementQuantity(barcode: string) { this.updateQuantity(barcode, 1); }
  decrementQuantity(barcode: string) { this.updateQuantity(barcode, -1); }
  
  onIncrementPress(barcode: string) { 
    this.homeService.ui.startTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  onDecrementPress(barcode: string) { 
    this.homeService.ui.startTimer(barcode, false, this.updateQuantity.bind(this));
  }
  
  onButtonRelease() { 
    this.homeService.ui.clearTimer();
  }

  private updateQuantity(barcode: string, amount: number) {
    // Usa il sistema avanzato di gestione quantità con moltiplicatori e controllo disponibilità
    const result = this.homeService.ui.updateQuantity(this.quantities, barcode, amount, this.availableQuantities);
    this.quantities = result.quantities;
    
    // Non mostrare più alert quando si raggiunge il limite - il pulsante è disabilitato
    
    // Trova il prodotto corrispondente
    const cartItem = this.findCartItemByBarcode(barcode);
    if (cartItem) {
      const product = {
        id: cartItem.id,
        barcode: cartItem.barcode,
        name: cartItem.name,
        description: cartItem.description,
        price: cartItem.originalPrice || cartItem.price, // Use original price if available
        offer_price: cartItem.onOffer ? cartItem.price : undefined, // Set offer_price if item is on offer
        on_offer: cartItem.onOffer
      };
      const supermarket = {
        id: cartItem.supermarketId,
        name: cartItem.supermarketName
      };
      
      // Aggiorna il carrello con la nuova quantità
      const newQuantity = result.quantities[barcode] || 0;
      this.homeService.cart.updateCartItem(product, supermarket, newQuantity);
    }
  }
  
  private findCartItemByBarcode(barcode: string): any | undefined {
    return this.cartItems.find(item => item.barcode === barcode);
  }

  removeItem(barcode: string) {
    const item = this.findCartItemByBarcode(barcode);
    if (!item) return;
    
    this.alertMessage = `Vuoi rimuovere "${item.name}" dal carrello?`;
    this.alertButtons = [
      {
        text: 'Annulla',
        role: 'cancel'
      },
      {
        text: 'Rimuovi',
        role: 'destructive',
        handler: () => {
          this.homeService.cart.removeFromCart(item.id, item.supermarketId);
          this.showToast('Articolo rimosso dal carrello');
        }
      }
    ];
    this.isAlertOpen = true;
  }

  clearCart() {
    if (this.cartItems.length === 0) return;
    
    this.alertMessage = 'Vuoi svuotare completamente il carrello?';
    this.alertButtons = [
      {
        text: 'Annulla',
        role: 'cancel'
      },
      {
        text: 'Svuota',
        role: 'destructive',
        handler: () => {
          this.homeService.cart.clearCart();
          this.showToast('Carrello svuotato');
        }
      }
    ];
    this.isAlertOpen = true;
  }

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

  proceedToCheckout() {
    if (this.cartItems.length === 0) {
      this.showAlert('error', 'Carrello vuoto', 'Aggiungi alcuni prodotti prima di procedere al pagamento');
      return;
    }

    // Verifica che tutti i prodotti abbiano quantità > 0
    const itemsWithQuantity = this.cartItems.filter(item => 
      this.quantities[item.barcode] && this.quantities[item.barcode] > 0
    );

    if (itemsWithQuantity.length === 0) {
      this.showAlert('error', 'Nessun prodotto selezionato', 'Seleziona almeno un prodotto per procedere');
      return;
    }

    // Imposta stato di caricamento
    this.isProcessingPayment = true;
    this.showAlert('success', 'Elaborazione in corso...', 'Sto processando il tuo ordine, attendere...');

    // Effettua gli acquisti
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

  private handlePurchaseSuccess(responses: any[]): void {
    const totalQuantity = responses.reduce((sum, response) => sum + response.data.quantity, 0);
    const totalAmount = responses.reduce((sum, response) => sum + response.data.total_price, 0);

    // Riduci le quantità disponibili nell'inventario
    responses.forEach(response => {
      const purchasedItem = this.cartItems.find(item => item.id === response.data.product_id);
      if (purchasedItem) {
        this.homeService.ui.reduceQuantity(
          purchasedItem.barcode, 
          purchasedItem.supermarketId, 
          response.data.quantity
        );
      }
    });
    this.homeService.cart.clearCart();
    this.showAlert(
      'success', 
      'Acquisto completato!', 
      `Hai acquistato un totale di ${totalQuantity} prodott${totalQuantity === 1 ? 'o' : 'i'} per un totale di €${totalAmount.toFixed(2)}`
    );
    setTimeout(() => {
      this.router.navigate(['/home/ordini']);
    }, 3000);
  }

  private handlePurchaseError(error: any): void {
    console.error('Purchase error:', error);
    
    let errorMessage = 'Si è verificato un errore durante l\'acquisto';
    let errorTitle = 'Errore';

    if (error.error) {
      if (error.error.message) {
        errorMessage = error.error.message;
      }
      
      if (error.status === 401) {
        errorTitle = 'Accesso negato';
        errorMessage = 'Devi effettuare il login per completare l\'acquisto';
      } else if (error.status === 400) {
        errorTitle = 'Dati non validi';
        if (error.error.available_quantity !== undefined) {
          errorMessage = `Quantità non disponibile. Disponibili: ${error.error.available_quantity}`;
        }
      } else if (error.status === 404) {
        errorTitle = 'Prodotto non trovato';
        errorMessage = 'Uno o più prodotti nel carrello non sono più disponibili';
      }
    }

    this.showAlert('error', errorTitle, errorMessage);
  }

  continueShopping() {
    this.router.navigate(['/home/dashboard']);
  }

  private showToast(message: string) {
    this.toastMessage = message;
    this.isToastOpen = true;
  }

  trackByGroup(index: number, group: {key: string, value: any[], name: string, id: number}): string {
    return group ? group.key : index.toString();
  }

  trackByItem(index: number, item: any): string {
    return item ? `${item.id}-${item.supermarketId}` : index.toString();
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

  // Gestione immagini prodotti
  getProductImage(barcode: string): string {
    if (!barcode) return 'assets/images/placeholder.png';
    if (this.imageCache[barcode]) {
      return this.imageCache[barcode];
    }
    try {
      const imageCache = localStorage.getItem('productImageCache');
      if (imageCache) {
        const cache = JSON.parse(imageCache);
        if (cache[barcode]?.url) {
          this.imageCache[barcode] = cache[barcode].url;
          return this.imageCache[barcode];
        }
      }
      const productData = localStorage.getItem(`product_${barcode}`);
      if (productData) {
        const product = JSON.parse(productData);
        if (product.image_url) {
          this.imageCache[barcode] = product.image_url;
          return this.imageCache[barcode];
        } else if (product.url) {
          this.imageCache[barcode] = product.url;
          return this.imageCache[barcode];
        }
      }
    } catch (error) {
      console.error('Error getting product image:', error);
    }
    this.imageCache[barcode] = 'assets/images/placeholder.png';
    return this.imageCache[barcode];
  }

  handleImageError(event: any, productName: string) {
    if (event.target) {
      event.target.src = 'assets/images/placeholder.png';
    }
  }

  // Gestione alert personalizzati
  get alertIcon(): string {
    return this.alertType === 'success' ? 'checkmark-circle' : 'alert-circle';
  }

  showAlert(type: 'success' | 'error', title: string, message: string): void {
    this.alertType = type;
    this.alertTitle = title;
    this.alertMessageCustom = message;
    this.showCustomAlert = true;
  }

  closeAlert(): void {
    this.showCustomAlert = false;
  }
}
