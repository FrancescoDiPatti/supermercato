import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { lastValueFrom } from 'rxjs';
import { 
  IonContent, IonIcon, IonImg, IonFabButton, IonButton, IonBadge
} from '@ionic/angular/standalone';
import { HomeService, Product, Category, PurchaseHistory, Supermarket } from '../../services/home/home.service';
import { addIcons } from 'ionicons';
import { add, remove, storefront, checkmarkCircle, flash, pricetag, arrowForward, cube, dice, alertCircle, close } from 'ionicons/icons';

@Component({
  selector: 'app-offerte',
  templateUrl: './offerte.page.html',
  styleUrls: ['./offerte.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonImg, IonFabButton, IonButton, IonBadge, CommonModule, FormsModule, RouterModule]
})
export class OffertePage implements OnInit, OnDestroy {

  private isLoading = false;

  // Data state
  private dataState = this.homeService.ui.createDataState();
  private animationState = this.homeService.ui.createAnimationState();
  
  // Supermarket data
  selectedSupermarket: Supermarket | null = null;

  // Alert properties
  showCustomAlert = false;
  alertType: 'success' | 'error' = 'success';
  alertTitle = '';
  alertMessage = '';

  // Search highlighting
  highlightedProductId: string | null = null;
  private searchEventListener: any;

  // Get the appropriate icon based on alert type
  get alertIcon(): string {
    return this.alertType === 'success' ? 'checkmark-circle' : 'alert-circle';
  }

  constructor(
    private homeService: HomeService,
    private router: Router,
  ) { 
    addIcons({ add, remove, storefront, checkmarkCircle, flash, pricetag, arrowForward, cube, dice, alertCircle, close });
  }

  ngOnInit() {
    this.initializeComponent();
    this.setupSearchListener();
  }

  async ionViewWillEnter() {
    if (this.isLoading) return;
    // Refresh data when entering the page
    const currentSupermarket = this.homeService.supermarkets.getSelectedSupermarket();
    if (currentSupermarket && currentSupermarket !== this.selectedSupermarket) {
      this.selectedSupermarket = currentSupermarket;
      await this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  private async initializeComponent() {
    // Subscribe to selected supermarket changes
    this.homeService.supermarkets.selectedSupermarket$.subscribe(async (supermarket: Supermarket | null) => {
      this.selectedSupermarket = supermarket;
      if (supermarket) {
        await this.loadSupermarketData();
      } else {
        this.homeService.ui.clearSupermarketData(this.dataState);
      }
      this.loadQuantitiesFromCart();
    });

    // Load initial data if a supermarket is already selected
    const currentSupermarket = this.homeService.supermarkets.getSelectedSupermarket();
    if (currentSupermarket) {
      this.selectedSupermarket = currentSupermarket;
      await this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  private async loadSupermarketData(): Promise<void> {
    if (!this.selectedSupermarket || this.isLoading) return;
    
    this.isLoading = true;
    
    try {
      // Pulisci lo stato esistente per evitare duplicati
      this.homeService.ui.clearSupermarketData(this.dataState);
      
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.dataState, 
        false, // don't load regular products for offers page
        true   // load offers
      );
      
      // Carica le quantità disponibili
      this.loadAvailableQuantities();
      
      // Focus only on offer products
      if (result.offerProducts && result.offerProducts.length > 0) {
        await this.homeService.products.loadImagesForLoadedProducts(result.offerProducts);
        // Update categories based only on offer products
        this.updateCategories(result.offerProducts);
      } else {
        // Clear categories if no offers
        this.homeService.ui.updateCategories(this.dataState, []);
      }
    } catch (error) {
      // In case of error, clear the data state
      this.homeService.ui.clearSupermarketData(this.dataState);
    } finally {
      this.isLoading = false;
    }
  }
  
  private updateCategories(offerProducts: Product[]): void {
    const categories = this.homeService.products.generateCategories(offerProducts);
    this.homeService.ui.updateCategories(this.dataState, categories);
  }

  private loadAvailableQuantities(): void {
    if (!this.selectedSupermarket) return;
    this.availableQuantities = this.homeService.ui.getAvailableQuantities(this.selectedSupermarket.id);
  }

  // Getters - Focus on offers
  get products() { return this.dataState.products; }
  get offerProducts() { return this.dataState.offerProducts; }
  get selectedCategory() { return this.dataState.selectedCategory; }
  get categories() { 
    // Use the categories from dataState that are already generated
    return this.dataState.categories;
  }
  quantities: { [barcode: string]: number } = {};
  availableQuantities: { [barcode: string]: number } = {};
  get displayOfferProducts() { return this.filteredOfferProducts.slice(0, 12); } // Show more offers
  get filteredOfferProducts() {
    return this.homeService.products.filterProductsByCategory(this.offerProducts, this.selectedCategory);
  }
  get canCreateContent() { return this.homeService.isUserAdmin() || this.homeService.isUserManager(); }
  getDisplayPrice(product: Product): number {
    return this.homeService.products.getDisplayPrice(product); 
  }
  getOriginalPrice(product: Product): number | null {
    return this.homeService.products.getOriginalPrice(product);
  }

  // Calculate discount percentage for offers
  calculateDiscount(product: Product): number {
    try {
      const originalPrice = this.getOriginalPrice(product);
      const currentPrice = this.getDisplayPrice(product);
      if (!originalPrice || originalPrice <= currentPrice) return 0;
      return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    } catch (error) {
      return 0;
    }
  }

  private updateQuantity(barcode: string, amount: number) {
    const result = this.homeService.ui.updateQuantity(this.quantities, barcode, amount, this.availableQuantities);
    this.quantities = result.quantities;
    
    // Non mostrare più alert quando si raggiunge il limite - il pulsante è disabilitato
  
    const product = this.findProductByBarcode(barcode);
    if (product && this.selectedSupermarket) {
      const quantity = this.quantities[barcode] || 0;
      this.homeService.cart.updateCartItem(product, this.selectedSupermarket, quantity);
    }
  }

  private findProductByBarcode(barcode: string): Product | undefined {
    // Since this is the offers page, only search in offer products
    return this.offerProducts.find(p => p.barcode === barcode);
  }

  private loadQuantitiesFromCart(): void {
    this.quantities = {};
    if (!this.selectedSupermarket) return;

    const cartItems = this.homeService.cart.getCartItems();
    cartItems
      .filter((item: any) => item.supermarketId === this.selectedSupermarket!.id)
      .forEach((item: any) => {
        this.quantities[item.barcode] = item.quantity;
      });
  }

  // Show custom alert
  showAlert(type: 'success' | 'error', title: string, message: string): void {
    this.alertType = type;
    this.alertTitle = title;
    this.alertMessage = message;
    this.showCustomAlert = true;
  }

  // Close custom alert
  closeAlert(): void {
    this.showCustomAlert = false;
  }

  onCreateOffer() {
    this.router.navigate(['/home/gestione/aggiungi-offerta']);
  }

  onCreateProduct() {
    this.router.navigate(['/home/gestione/aggiungi-prodotto']);
  }

  // Genera offerte casuali per il supermercato selezionato
  async onGenerateOffer() {
    if (!this.selectedSupermarket) {
      this.showAlert('error', 'Errore', 'Seleziona un supermercato per generare le offerte');
      return;
    }

    try {
      this.isLoading = true;
      const response = await lastValueFrom(
        this.homeService.products.generateOffers(this.selectedSupermarket.id)
      );

      this.homeService.ui.clearSupermarketData(this.dataState);

      let offerProducts = await this.homeService.products.loadSupermarketOffers(this.selectedSupermarket.id);
      offerProducts = this.deduplicateOffers(offerProducts); // Applica la deduplica
      this.homeService.ui.updateOfferProducts(this.dataState, offerProducts);

      if (offerProducts && offerProducts.length > 0) {
        await this.homeService.products.loadImagesForLoadedProducts(offerProducts);
        this.updateCategories(offerProducts);
        this.startOfferAnimations();
      } else {
        this.homeService.ui.updateCategories(this.dataState, []);
      }

      this.loadQuantitiesFromCart();

      this.showAlert('success', 'Successo', 'Offerte generate con successo!');
    } catch (error) {
      this.showAlert('error', 'Errore', 'Si è verificato un errore durante la generazione delle offerte');
    } finally {
      this.isLoading = false;
    }
  }

  private deduplicateOffers(offers: Product[]): Product[] {
    const seenBarcodes = new Set<string>();
    const deduplicatedOffers: Product[] = [];

    for (const offer of offers) {
      const barcode = offer.barcode || `undefined-${Math.random()}`; // Gestione di barcode undefined
      if (!seenBarcodes.has(barcode)) {
        seenBarcodes.add(barcode);
        deduplicatedOffers.push(offer);
      }
    }

    return deduplicatedOffers;
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
  
  onCategorySelect(categoryName: string) {
    this.homeService.ui.setSelectedCategory(this.dataState, categoryName);
    this.homeService.ui.showCategoryProducts(this.displayOfferProducts, this.animationState);
  }
  
  private startOfferAnimations() {
    this.homeService.ui.showCategoryProducts(this.displayOfferProducts, this.animationState);
  }
  
  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }

  // Setup search event listener
  private setupSearchListener() {
    this.searchEventListener = (event: CustomEvent) => {
      const product = event.detail.product;
      this.highlightProduct(product);
    };
    window.addEventListener('offerSelectedFromSearch', this.searchEventListener);
  }

  // Cleanup search listener
  ngOnDestroy() {
    if (this.searchEventListener) {
      window.removeEventListener('offerSelectedFromSearch', this.searchEventListener);
    }
  }

  // Highlight selected product
  private highlightProduct(product: any) {
    const productId = product.barcode || product.id.toString();
    this.highlightedProductId = productId;
    
    // Scroll to highlighted product after a short delay
    setTimeout(() => {
      this.scrollToProduct(productId);
    }, 100);
    
    // Clear highlight after 3 seconds
    setTimeout(() => {
      this.highlightedProductId = null;
    }, 3000);
  }

  // Scroll to specific product
  private scrollToProduct(productId: string) {
    const element = document.getElementById(`offer-${productId}`);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }

  // Check if product is highlighted
  isProductHighlighted(product: any): boolean {
    const productId = product.barcode || product.id.toString();
    return this.highlightedProductId === productId;
  }
}

