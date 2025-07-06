import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { 
  IonContent, IonIcon, IonImg, IonFabButton, IonButton, IonBadge
} from '@ionic/angular/standalone';
import { HomeService, Product, Supermarket, SupermarketDataState, AnimationState } from '../../services/home/home.service';
import { addIcons } from 'ionicons';
import { add, remove, storefront, checkmarkCircle } from 'ionicons/icons';

@Component({
  selector: 'app-prodotti',
  templateUrl: './prodotti.page.html',
  styleUrls: ['./prodotti.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonIcon, IonImg, IonFabButton, IonButton, IonBadge,
    CommonModule, FormsModule, RouterModule,
  ]
})
export class ProdottiPage implements OnInit, OnDestroy, ViewWillEnter {
  // State variables
  private readonly dataState: SupermarketDataState = this.homeService.ui.createDataState();
  private readonly animationState: AnimationState = this.homeService.ui.createAnimationState();
  
  // Data variables
  public selectedSupermarket: Supermarket | null = null;
  public quantities: { [barcode: string]: number } = {};
  public availableQuantities: { [barcode: string]: number } = {};
  public highlightedProductId: string | null = null;

  // Event listeners
  private searchEventListener: any;
  private offerSearchEventListener: any;

  constructor(
    private readonly homeService: HomeService,
    private readonly router: Router,
  ) { 
    addIcons({ add, remove, storefront, checkmarkCircle });
  }

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.setupSearchListener();
  }

  async ionViewWillEnter(): Promise<void> {
    const currentSupermarket = this.homeService.supermarkets.getSelectedSupermarket();
    if (currentSupermarket && currentSupermarket !== this.selectedSupermarket) {
      this.selectedSupermarket = currentSupermarket;
      await this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
  }

  // Initialize component subscriptions
  private initializeSubscriptions(): void {
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
      this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  // Setup search event listeners
  private setupSearchListener(): void {
    this.searchEventListener = (event: CustomEvent) => {
      const product = event.detail.product;
      this.highlightProduct(product);
    };
    window.addEventListener('productSelectedFromSearch', this.searchEventListener);
    
    this.offerSearchEventListener = (event: CustomEvent) => {
      const product = event.detail.product;
      this.highlightProduct(product);
    };
    window.addEventListener('offerSelectedFromSearch', this.offerSearchEventListener);
  }

  // Remove event listeners
  private removeEventListeners(): void {
    if (this.searchEventListener) {
      window.removeEventListener('productSelectedFromSearch', this.searchEventListener);
    }
    if (this.offerSearchEventListener) {
      window.removeEventListener('offerSelectedFromSearch', this.offerSearchEventListener);
    }
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
    const element = document.getElementById(`product-${productId}`);
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

  // Load supermarket data and images
  private async loadSupermarketData(): Promise<void> {
    if (!this.selectedSupermarket) return;
    try {
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.dataState, 
        true, 
        true  
      );
      this.loadAvailableQuantities();
      const allProducts = [...result.products, ...result.offerProducts];
      if (allProducts.length > 0) {
        await this.homeService.products.loadImagesForLoadedProducts(allProducts);
        this.updateCategories(allProducts);
      }
    } catch (error) {
      console.error('Error loading supermarket data:', error);
    }
  }
  
  // Update categories
  private updateCategories(products: Product[]): void {
    const categories = this.homeService.products.generateCategories(products);
    this.homeService.ui.updateCategories(this.dataState, categories);
  }

  // Load available quantities
  private loadAvailableQuantities(): void {
    if (!this.selectedSupermarket) return;
    this.availableQuantities = this.homeService.ui.getAvailableQuantities(this.selectedSupermarket.id);
  }

  // Data getter
  get products(): Product[] { 
    return this.dataState.products; 
  }
  
  get offerProducts(): Product[] { 
    return this.dataState.offerProducts; 
  }
  
  get selectedCategory(): string { 
    return this.dataState.selectedCategory; 
  }
  
  get categories(): any[] { 
    return this.dataState.categories; 
  }
  
  get displayProducts(): Product[] { 
    return this.filteredProducts.slice(0, 8); 
  }
  
  get filteredProducts(): Product[] {
    const allProducts = [...this.products, ...this.offerProducts];
    return this.homeService.products.filterProductsByCategory(allProducts, this.selectedCategory);
  }
  
  get canCreateContent(): boolean { 
    return this.homeService.isUserAdmin() || this.homeService.isUserManager(); 
  }

  // Price calculation
  getDisplayPrice(product: Product): number {
    return this.homeService.products.getDisplayPrice(product); 
  }
  
  getOriginalPrice(product: Product): number | null {
    return this.homeService.products.getOriginalPrice(product);
  }

  // Quantity management
  private updateQuantity(barcode: string, amount: number): void {
    const result = this.homeService.ui.updateQuantity(this.quantities, barcode, amount, this.availableQuantities);
    this.quantities = result.quantities;
    
    const product = this.findProductByBarcode(barcode);
    if (product && this.selectedSupermarket) {
      const quantity = this.quantities[barcode] || 0;
      this.homeService.cart.updateCartItem(product, this.selectedSupermarket, quantity);
    }
  }

  // Find product by barcode in products or offers
  private findProductByBarcode(barcode: string): Product | undefined {
    let product = this.products.find(p => p.barcode === barcode);
    if (!product) {
      product = this.offerProducts.find(p => p.barcode === barcode);
    }
    return product;
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

  // Navigate to product creation
  onCreateProduct(): void {
    this.router.navigate(['/home/gestione/aggiungi-prodotto']);
  }

  // Quantity increment/decrement methods
  incrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, 1); 
  }
  
  decrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, -1); 
  }
  
  // Button press handlers for long press functionality
  onIncrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  onDecrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, false, this.updateQuantity.bind(this));
  }
  
  onButtonRelease(): void { 
    this.homeService.ui.clearTimer();
  }
  
  // Category selection handler
  onCategorySelect(categoryName: string): void {
    this.homeService.ui.setSelectedCategory(this.dataState, categoryName);
    this.homeService.ui.showCategoryProducts(this.displayProducts, this.animationState);
  }
  
  // Image loading errors
  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }
}
