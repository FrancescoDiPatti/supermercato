import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { 
  IonContent, IonIcon, IonImg, IonFabButton, IonButton, IonBadge
} from '@ionic/angular/standalone';
import { HomeService, Product, Category, PurchaseHistory } from '../home.service';
import { Supermarket } from '../../services/supermercati/supermercati.service';
import { SupermarketDataState, AnimationState } from '../../services/ui/ui.service';
import { CarrelloService } from '../../services/carrello/carrello.service';
import { ProdottiService } from '../../services/prodotti/prodotti.service';
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

  // Data state
  private dataState: SupermarketDataState = this.homeService.createDataState();
  private animationState: AnimationState = this.homeService.createAnimationState();
  
  // Supermarket data
  selectedSupermarket: Supermarket | null = null;

  // Search highlighting
  highlightedProductId: string | null = null;
  private searchEventListener: any;
  private offerSearchEventListener: any;

  constructor(
    private homeService: HomeService,
    private carrelloService: CarrelloService,
    private prodottiService: ProdottiService,
    private router: Router,
  ) { 
    addIcons({ add, remove, storefront, checkmarkCircle });
  }

  ngOnInit() {
    this.initializeSubscriptions();
    this.setupSearchListener();
  }

  async ionViewWillEnter() {
    // Refresh data when entering the page
    const currentSupermarket = this.homeService.getSelectedSupermarket();
    if (currentSupermarket && currentSupermarket !== this.selectedSupermarket) {
      this.selectedSupermarket = currentSupermarket;
      await this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  // Initialize subscriptions
  private initializeSubscriptions() {
    // Subscribe to selected supermarket changes
    this.homeService.selectedSupermarket$.subscribe(async supermarket => {
      this.selectedSupermarket = supermarket;
      if (supermarket) {
        await this.loadSupermarketData();
      } else {
        this.homeService.clearSupermarketData(this.dataState);
      }
      this.loadQuantitiesFromCart();
    });

    // Load initial data if a supermarket is already selected
    const currentSupermarket = this.homeService.getSelectedSupermarket();
    if (currentSupermarket) {
      this.selectedSupermarket = currentSupermarket;
      this.loadSupermarketData();
      this.loadQuantitiesFromCart();
    }
  }

  // Setup search event listener
  private setupSearchListener() {
    this.searchEventListener = (event: CustomEvent) => {
      const product = event.detail.product;
      this.highlightProduct(product);
    };
    window.addEventListener('productSelectedFromSearch', this.searchEventListener);
    
    // Also listen for offer searches since products page shows both
    this.offerSearchEventListener = (event: CustomEvent) => {
      const product = event.detail.product;
      this.highlightProduct(product);
    };
    window.addEventListener('offerSelectedFromSearch', this.offerSearchEventListener);
  }

  // Cleanup search listener
  ngOnDestroy() {
    if (this.searchEventListener) {
      window.removeEventListener('productSelectedFromSearch', this.searchEventListener);
    }
    if (this.offerSearchEventListener) {
      window.removeEventListener('offerSelectedFromSearch', this.offerSearchEventListener);
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

  private async loadSupermarketData(): Promise<void> {
    if (!this.selectedSupermarket) return;
    
    try {
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.dataState, 
        true, // load products
        true  // load offers
      );
      
      // Carica le quantità disponibili
      this.loadAvailableQuantities();
      
      const allProducts = [...result.products, ...result.offerProducts];
      if (allProducts.length > 0) {
        await this.homeService.loadImagesForLoadedProducts(allProducts);
      }
      
      // Aggiorna le categorie
      if (allProducts.length > 0) {
        this.updateCategories(allProducts);
      }
    } catch (error) {
      console.error('Error loading supermarket data:', error);
    }
  }
  
  private updateCategories(products: Product[]): void {
    const categories = this.homeService.generateCategories(products);
    this.homeService.updateCategories(this.dataState, categories);
  }

  private loadAvailableQuantities(): void {
    if (!this.selectedSupermarket) return;
    this.availableQuantities = this.homeService.getAvailableQuantities(this.selectedSupermarket.id);
  }

  // Getters
  get products() { return this.dataState.products; }
  get offerProducts() { return this.dataState.offerProducts; }
  get selectedCategory() { return this.dataState.selectedCategory; }
  get categories() { return this.dataState.categories; }
  quantities: { [barcode: string]: number } = {};
  availableQuantities: { [barcode: string]: number } = {};
  get displayProducts() { return this.filteredProducts.slice(0, 8); }
  get displayOfferProducts() { return this.filteredOfferProducts.slice(0, 8); }
  get filteredProducts() {
    const allProducts = [...this.products, ...this.offerProducts];
    return this.homeService.filterProductsByCategory(allProducts, this.selectedCategory);
  }
  get filteredOfferProducts() {
    return this.homeService.filterProductsByCategory(this.offerProducts, this.selectedCategory);
  }
  get canCreateContent() { return this.homeService.isUserAdmin() || this.homeService.isUserManager(); }
  getDisplayPrice(product: Product): number {
    return this.homeService.getDisplayPrice(product); 
  }
  getOriginalPrice(product: Product): number | null {
    return this.homeService.getOriginalPrice(product);
  }

  private updateQuantity(barcode: string, amount: number) {
    const result = this.homeService.updateQuantity(this.quantities, barcode, amount, this.availableQuantities);
    this.quantities = result.quantities;
    
    // Non mostrare più alert quando si raggiunge il limite - il pulsante è disabilitato
  
    const product = this.findProductByBarcode(barcode);
    if (product && this.selectedSupermarket) {
      const quantity = this.quantities[barcode] || 0;
      this.carrelloService.updateCartItem(product, this.selectedSupermarket, quantity);
    }
  }

  private findProductByBarcode(barcode: string): Product | undefined {
    let product = this.products.find(p => p.barcode === barcode);
    if (!product) {
      product = this.offerProducts.find(p => p.barcode === barcode);
    }
    return product;
  }

  private loadQuantitiesFromCart(): void {
    this.quantities = {};
    if (!this.selectedSupermarket) return;

    const cartItems = this.carrelloService.getCartItems();
    cartItems
      .filter(item => item.supermarketId === this.selectedSupermarket!.id)
      .forEach(item => {
        this.quantities[item.barcode] = item.quantity;
      });
  }

  onCreateProduct() {
    this.router.navigate(['/home/gestione/aggiungi-prodotto']);
  }

  incrementQuantity(barcode: string) { this.updateQuantity(barcode, 1); }
  decrementQuantity(barcode: string) { this.updateQuantity(barcode, -1); }
  
  onIncrementPress(barcode: string) { 
    this.homeService.startQuantityTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  onDecrementPress(barcode: string) { 
    this.homeService.startQuantityTimer(barcode, false, this.updateQuantity.bind(this));
  }
  
  onButtonRelease() { 
    this.homeService.clearQuantityTimer();
  }
  
  onCategorySelect(categoryName: string) {
    this.homeService.setSelectedCategory(this.dataState, categoryName);
    this.homeService.startCategoryAnimation(this.displayProducts, this.animationState);
  }
  
  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }
}
