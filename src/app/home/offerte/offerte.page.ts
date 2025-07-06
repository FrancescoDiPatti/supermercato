import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { lastValueFrom, Observable } from 'rxjs';
import { 
  IonContent, IonIcon, IonImg, IonFabButton, IonButton, IonBadge
} from '@ionic/angular/standalone';
import { HomeService, Product, Category, PurchaseHistory, Supermarket } from '../../services/home/home.service';
import { addIcons } from 'ionicons';
import { add, remove, storefront, checkmarkCircle, flash,
         pricetag, arrowForward, cube, dice, alertCircle,
         close
        } from 'ionicons/icons';

@Component({
  selector: 'app-offerte',
  templateUrl: './offerte.page.html',
  styleUrls: ['./offerte.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonImg, IonFabButton, IonButton, IonBadge, CommonModule, FormsModule, RouterModule]
})
export class OffertePage implements OnInit, OnDestroy {

  // Component variables
  private isLoading = false;
  private readonly dataState = this.homeService.ui.createDataState();
  private readonly animationState = this.homeService.ui.createAnimationState();
  readonly currentUser$ = this.homeService.currentUser$;
  
  // Supermarket variables
  public selectedSupermarket: Supermarket | null = null;

  // Alert variables
  public showCustomAlert = false;
  public alertType: 'success' | 'error' = 'success';
  public alertTitle = '';
  public alertMessage = '';

  // Product quantities
  public quantities: { [barcode: string]: number } = {};
  public availableQuantities: { [barcode: string]: number } = {};

  // Search highlighting
  public highlightedProductId: string | null = null;
  private searchEventListener: any;

  // Get alert icon
  get alertIcon(): string {
    return this.alertType === 'success' ? 'checkmark-circle' : 'alert-circle';
  }

  constructor(
    private readonly homeService: HomeService,
    private readonly router: Router,
  ) { 
    addIcons({ 
      add, remove, storefront, checkmarkCircle, flash, pricetag, 
      arrowForward, cube, dice, alertCircle, close 
    });
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupSearchListener();
  }

  ngOnDestroy(): void {
    if (this.searchEventListener) {
      window.removeEventListener('offerSelectedFromSearch', this.searchEventListener);
    }
  }

  // Handle page entry
  async ionViewWillEnter(): Promise<void> {
    if (this.isLoading) return;
    const currentSupermarket = this.homeService.supermarkets.getSelectedSupermarket();
    if (currentSupermarket && currentSupermarket !== this.selectedSupermarket) {
      this.selectedSupermarket = currentSupermarket;
      await this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  // Initialize component
  private async initializeComponent(): Promise<void> {
    this.homeService.supermarkets.selectedSupermarket$.subscribe(async (supermarket: Supermarket | null) => {
      this.selectedSupermarket = supermarket;
      if (supermarket) {
        await this.loadSupermarketData();
      } else {
        this.homeService.ui.clearSupermarketData(this.dataState);
      }
      this.loadQuantitiesFromCart();
    });
    const currentSupermarket = this.homeService.supermarkets.getSelectedSupermarket();
    if (currentSupermarket) {
      this.selectedSupermarket = currentSupermarket;
      await this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  // Load supermarket data
  private async loadSupermarketData(): Promise<void> {
    if (!this.selectedSupermarket || this.isLoading) return;
    this.isLoading = true;
    try {
      this.homeService.ui.clearSupermarketData(this.dataState);
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.dataState, 
        false,
        true
      );
      this.loadAvailableQuantities();
      if (result.offerProducts && result.offerProducts.length > 0) {
        await this.homeService.products.loadImagesForLoadedProducts(result.offerProducts);
        this.updateCategories(result.offerProducts);
      } else {
        this.homeService.ui.updateCategories(this.dataState, []);
      }
    } catch (error) {
      this.homeService.ui.clearSupermarketData(this.dataState);
    } finally {
      this.isLoading = false;
    }
  }
  
  // Update categories based on offer products
  private updateCategories(offerProducts: Product[]): void {
    const categories = this.homeService.products.generateCategories(offerProducts);
    this.homeService.ui.updateCategories(this.dataState, categories);
  }

  // Load available quantities from supermarket
  private loadAvailableQuantities(): void {
    if (!this.selectedSupermarket) return;
    this.availableQuantities = this.homeService.ui.getAvailableQuantities(this.selectedSupermarket.id);
  }

  // Data getters
  get products() { return this.dataState.products;}
  get offerProducts() { return this.dataState.offerProducts;}
  get selectedCategory() { return this.dataState.selectedCategory;}
  get categories() { return this.dataState.categories;}
  get displayOfferProducts() { return this.filteredOfferProducts.slice(0, 12);}
  get filteredOfferProducts() {
    return this.homeService.products.filterProductsByCategory(this.offerProducts, this.selectedCategory);
  }

  // Get display price for product
  getDisplayPrice(product: Product): number {
    return this.homeService.products.getDisplayPrice(product); 
  }

  // Get original price for product
  getOriginalPrice(product: Product): number | null {
    return this.homeService.products.getOriginalPrice(product);
  }

  // Calculate discount percentage
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

  // Update product quantity
  private updateQuantity(barcode: string, amount: number): void {
    const result = this.homeService.ui.updateQuantity(this.quantities, barcode, amount, this.availableQuantities);
    this.quantities = result.quantities;
  
    const product = this.findProductByBarcode(barcode);
    if (product && this.selectedSupermarket) {
      const quantity = this.quantities[barcode] || 0;
      this.homeService.cart.updateCartItem(product, this.selectedSupermarket, quantity);
    }
  }

  // Find product by barcode
  private findProductByBarcode(barcode: string): Product | undefined {
    return this.offerProducts.find(p => p.barcode === barcode);
  }

  // Load cart quantities for display
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

  // Display custom alert
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

  // Navigate to create product page
  onCreateProduct(): void {
    this.router.navigate(['/home/gestione/aggiungi-prodotto']);
  }

  // Generate random offers
  async onGenerateOffer(): Promise<void> {
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
      offerProducts = this.deduplicateOffers(offerProducts);
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

  // Remove duplicate offer
  private deduplicateOffers(offers: Product[]): Product[] {
    const seenBarcodes = new Set<string>();
    const deduplicatedOffers: Product[] = [];

    for (const offer of offers) {
      const barcode = offer.barcode || `undefined-${Math.random()}`;
      if (!seenBarcodes.has(barcode)) {
        seenBarcodes.add(barcode);
        deduplicatedOffers.push(offer);
      }
    }
    return deduplicatedOffers;
  }

  // Quantity control methods
  incrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, 1); 
  }
  
  decrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, -1); 
  }
  
  onIncrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  onDecrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, false, this.updateQuantity.bind(this));
  }
  
  onButtonRelease(): void { 
    this.homeService.ui.clearTimer();
  }
  
  // Handle category selection
  onCategorySelect(categoryName: string): void {
    this.homeService.ui.setSelectedCategory(this.dataState, categoryName);
    this.homeService.ui.showCategoryProducts(this.displayOfferProducts, this.animationState);
  }
  
  // Start offer animations
  private startOfferAnimations(): void {
    this.homeService.ui.showCategoryProducts(this.displayOfferProducts, this.animationState);
  }
  
  // Handle image loading errors
  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }

  // Setup search event listener
  private setupSearchListener(): void {
    this.searchEventListener = (event: CustomEvent) => {
      const product = event.detail.product;
      this.highlightProduct(product);
    };
    window.addEventListener('offerSelectedFromSearch', this.searchEventListener);
  }

  // Highlight selected product
  private highlightProduct(product: any): void {
    const productId = product.barcode || product.id.toString();
    this.highlightedProductId = productId;
    
    setTimeout(() => {
      this.scrollToProduct(productId);
    }, 100);
    
    setTimeout(() => {
      this.highlightedProductId = null;
    }, 3000);
  }

  // Scroll to specific product
  private scrollToProduct(productId: string): void {
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

