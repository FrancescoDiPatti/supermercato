import { Component, OnInit, HostListener, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  IonContent, IonIcon, IonSpinner, IonText,
  IonImg, IonBadge, IonFabButton, IonButton
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, remove, storefront, location, checkmarkCircle, chevronForwardOutline, map, chevronUp, chevronDown, cart } from 'ionicons/icons';
import { HomeService, Product, Category, PurchaseHistory, Supermarket, SupermarketDataState, AnimationState } from '../../services/home/home.service';
import { AuthService } from '../../auth/auth.service';
import { lastValueFrom } from 'rxjs';
import { skip } from 'rxjs/operators';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonIcon, IonSpinner, IonText,
    IonImg, IonBadge, IonFabButton, IonButton,
    CommonModule, FormsModule, RouterModule
  ]
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy, ViewWillEnter {
  
  // ViewChild references
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @ViewChild('supermarketsContainer', { static: false }) supermarketsContainer!: ElementRef;
  
  // Data properties
  public supermarkets: Supermarket[] = [];
  public selectedSupermarket: Supermarket | null = null;
  public isHistoryView = true;
  public quantities: { [barcode: string]: number } = {};
  public availableQuantities: { [barcode: string]: number } = {};
  
  // Loading states
  public isLoading = false;
  public isLocationLoading = false;
  
  // Location properties
  public userPosition: { lat: number; lng: number } | null = null;
  public locationEnabled = false;
  
  // Map properties
  public isMapExpanded = true;
  public map: L.Map | undefined;
  
  // Alert properties
  public showCustomAlert = false;
  public alertType: 'success' | 'error' = 'success';
  public alertTitle = '';
  public alertMessage = '';
  
  // Private state management
  private readonly dataState: SupermarketDataState = this.homeService.ui.createDataState();
  private readonly animationState = this.homeService.ui.createAnimationState();
  private readonly imageCache: {[key: string]: string} = {};
  private userExpandedMap = false;
  private markers: L.Marker[] = [];
  private userMarker: L.CircleMarker | undefined;
  private scrollListeners: Array<{ element: Element; listener: EventListener }> = [];
  
  // Event listeners
  private readonly searchListener = (event: any) => {
    if (event.detail?.supermarket) {
      this.selectedSupermarket = event.detail.supermarket;
      requestAnimationFrame(() => {
        this.selectSupermarket(event.detail.supermarket);
      });
    }
  };
  
  // Data getters
  get products() { return this.dataState.products; }
  get offerProducts() { return this.dataState.offerProducts; }
  get categories() { return this.dataState.categories; }
  get selectedCategory() { return this.dataState.selectedCategory; }
  get purchaseHistory() { return this.dataState.purchaseHistory; }
  get canCreateContent() { return this.homeService.isUserAdmin() || this.homeService.isUserManager(); }
  
  // Filter getters
  get filteredProducts() { 
    return this.homeService.products.filterProductsByCategory(this.products, this.selectedCategory);
  }
  get filteredOfferProducts() {
    return this.homeService.products.filterProductsByCategory(this.offerProducts, this.selectedCategory);
  }
  get displayProducts() { return this.filteredProducts.slice(0, 8); }
  get displayOfferProducts() { return this.filteredOfferProducts.slice(0, 8); }
  get viewContent() {
    return this.isHistoryView ? this.purchaseHistory : this.homeService.cart.getCartItems();
  }
  get alertIcon(): string {
    return this.alertType === 'success' ? 'checkmark-circle' : 'alert-circle';
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

  constructor(
    private readonly homeService: HomeService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    addIcons({ add, remove, storefront, location, checkmarkCircle, chevronForwardOutline, map, chevronUp, chevronDown, cart });
  }

  async ngOnInit(): Promise<void> {
    await this.initializeComponent();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.setupHorizontalScroll(), 500);
    if (this.isMapExpanded && !this.map) {
      requestAnimationFrame(() => this.initMap());
    }
  }

  ngOnDestroy(): void {
    this.homeService.ui.clearTimer();
    this.cleanup();
    window.removeEventListener('listenSMSelectionSearch', this.searchListener as EventListener);
  }

  ionViewWillEnter(): void {
    if (this.selectedSupermarket) {
      requestAnimationFrame(() => this.centerSelectedSupermarket(this.selectedSupermarket!));
    }
    this.loadQuantitiesFromCart();
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (this.selectedSupermarket) {
      requestAnimationFrame(() => this.centerSelectedSupermarket(this.selectedSupermarket!));
    }
  }

  // Initialize component
  private async initializeComponent(): Promise<void> {
    this.listenSMSelection();
    this.setupSearchListener();
    await this.loadPurchaseHistory();
    this.initializeUserLocation();
    await this.loadSupermarkets();
    this.autoExpandMapIfNeeded();
    this.reloadSM();
  }

  // Listen for supermarket selection changes
  private listenSMSelection(): void {
    this.homeService.supermarkets.selectedSupermarket$.pipe(skip(1)).subscribe(this.handleSupermarketSelection.bind(this));
  }  

  // Setup search event listener
  private setupSearchListener(): void {
    window.addEventListener('listenSMSelectionSearch', this.searchListener as EventListener);
  }

  // Load user purchase history
  private async loadPurchaseHistory(): Promise<void> {
    const purchaseHistory = this.canCreateContent ? [] : await this.homeService.products.loadPurchaseHistory(5);
    this.dataState.purchaseHistory = purchaseHistory;
  }

  // Initialize user location
  private async initializeUserLocation(): Promise<void> {
    try {
      const position = await this.homeService.position.getCurrentPosition();
      if (position) {
        this.userPosition = position;
        this.locationEnabled = true;
        this.updateMapWithUserLocation();
      }
    } catch (error) {}
  }

  // Enable location and center map on user position
  async enableLocationAndCenter(): Promise<void> {
    if (this.isLocationLoading) return;
    this.isLocationLoading = true;
    try {
      if (this.locationEnabled && this.userPosition) {
        if (this.map) {
          this.homeService.map.centerOnUserPosition(this.map, this.userPosition, 15);
        }
        return;
      }
      const position = await this.homeService.position.getCurrentPosition();
      if (position) {
        this.userPosition = position;
        this.locationEnabled = true;
        this.updateMapWithUserLocation();
        if (this.map) {
          this.homeService.map.centerOnUserPosition(this.map, position, 15);
        }
      }
    } catch (error) {
    } finally {
      this.isLocationLoading = false;
    }
  }

  // Update map with user location
  private updateMapWithUserLocation(): void {
    const hasSupermarkets = this.supermarkets.length > 0;
    const hasMap = !!this.map;
    const hasUserPosition = !!this.userPosition;
    
    if (hasSupermarkets && hasUserPosition) {
      this.sortSupermarketsByDistance();
    }
    if (hasMap) {
      if (hasUserPosition) {
        this.homeService.map.centerOnUserPosition(this.map!, this.userPosition!, 13);
      }
      this.setupMapMarkers();
    }
    if (hasSupermarkets && hasUserPosition) {
      setTimeout(() => this.setupHorizontalScroll(), 500);
    }
  }

  // Sort supermarkets by distance from user
  private sortSupermarketsByDistance(): void {
    if (!this.userPosition) return;
    
    this.supermarkets = this.homeService.supermarkets.sortByDistance(
      this.supermarkets, 
      this.userPosition.lat, 
      this.userPosition.lng
    );
  }

  // Initialize Leaflet map
  private initMap(): void {
    if (this.map || !this.mapContainer) return;
    try {
      const mapCenter: [number, number] = this.userPosition 
        ? [this.userPosition.lat, this.userPosition.lng] 
        : [41.9028, 12.4964];
      const mapZoom = this.userPosition ? 13 : 6;
      
      this.map = this.homeService.map.initializeMap(this.mapContainer.nativeElement, {
        center: mapCenter,
        zoom: mapZoom,
        zoomControl: false,
        maxZoom: 18,
        minZoom: 3,
        keyboard: false
      });
      
      if (this.map) {
        this.setupMapMarkers();
        if (this.userPosition) {
          this.homeService.map.centerOnUserPosition(this.map, this.userPosition, 13);
        }
      }
    } catch (error) {}
  }

  // Setup map markers
  private setupMapMarkers(): void {
    this.homeService.map.completeMapSetup(
      this.map!,
      this.userPosition || undefined,
      this.supermarkets,
      (supermarket: Supermarket) => this.selectSupermarket(supermarket),
      (userMarker: any) => this.userMarker = userMarker,
      (markers: any[]) => this.markers = markers
    );
  }

  // Toggle map expansion state
  toggleMap(): void {
    this.isMapExpanded = !this.isMapExpanded;
    this.userExpandedMap = this.isMapExpanded;
    this.handleMapExpansion();
  }
  
  // Auto expand map
  private autoExpandMapIfNeeded(): void {
    if (!this.selectedSupermarket && !this.isMapExpanded && this.supermarkets.length > 0) {
      this.isMapExpanded = true;
      this.userExpandedMap = false;
      this.handleMapExpansion();
    }
  }

  // Handle map expansion state
  private handleMapExpansion(): void {
    if (!this.isMapExpanded) return;
    requestAnimationFrame(() => {
      this.map ? this.map.invalidateSize() : this.initMap();
    });
  }

  // Load all supermarkets
  private async loadSupermarkets(): Promise<void> {
    await this.homeService.ui.executeWithLoading(
      (loading: boolean) => this.isLoading = loading,
      async () => {        
        this.supermarkets = await this.homeService.supermarkets.loadAndSetupSupermarkets(this.userPosition || undefined);
        if (this.userPosition) {
          this.sortSupermarketsByDistance();
        }
        requestAnimationFrame(() => {
          this.setupHorizontalScroll();
          if (this.map) {
            this.setupMapMarkers();
          }
          this.reloadSM();
        });
        return this.supermarkets;
      }
    );
  }

  // Handle supermarket selection changes
  private handleSupermarketSelection(supermarket: Supermarket | null): void {
    const isDifferentSupermarket = supermarket?.id !== this.selectedSupermarket?.id;
    if (supermarket && isDifferentSupermarket) {
      this.quantities = {};
      this.homeService.cart.clearCart();
      this.selectedSupermarket = supermarket;
      if (this.isMapExpanded && !this.userExpandedMap) {
        this.isMapExpanded = false;
      }
      this.onSupermarketChange();
      this.centerSelectedSupermarket(supermarket);
    } else if (!supermarket) {
      this.selectedSupermarket = null;
      this.autoExpandMapIfNeeded();
      this.onSupermarketChange();
    }
  }

  // Select a supermarket and update
  selectSupermarket(supermarket: Supermarket): void {
    if (this.selectedSupermarket?.id === supermarket.id) {
      this.centerSelectedSupermarket(supermarket);
      return;
    }
    this.quantities = {};
    this.homeService.cart.clearCart();

    this.homeService.supermarkets.setSelectedSupermarket(supermarket);
    this.homeService.map.selectSupermarketOnMap(supermarket, this.map, this.markers, false, 14);
    if (this.isMapExpanded && !this.userExpandedMap) {
      this.isMapExpanded = false;
    }
    this.centerSelectedSupermarket(supermarket);
    this.loadQuantitiesFromCart();
    setTimeout(() => this.setupHorizontalScroll(), 300);
  }

  // Center selected supermarket view and map
  private centerSelectedSupermarket(selectedSupermarket: Supermarket): void {
    this.homeService.ui.centerSelectedItem(
      this.supermarkets,
      selectedSupermarket, 
      this.supermarketsContainer
    );
    if (this.map) {
      this.homeService.map.selectSupermarketOnMap(selectedSupermarket, this.map, this.markers, false, 16, 0.5);
    }
  }

  // Handle supermarket change
  async onSupermarketChange(): Promise<void> {
    if (!this.selectedSupermarket) {
      this.homeService.ui.clearSupermarketData(this.dataState);
      this.resetAnimations();
      return;
    }
    if (this.dataState.selectedCategory) {
      this.dataState.selectedCategory = '';
    }
    await this.homeService.ui.executeWithLoading(
      (loading: boolean) => this.isLoading = loading,
      async () => {
        this.resetAnimations();
        const { products, offerProducts } = await this.loadSupermarketData();
        const allProducts = [...products, ...offerProducts];
        if (allProducts.length > 0) {
          await this.homeService.products.loadImagesForLoadedProducts(allProducts);
        }
        this.generateCategories();
        this.startProductAnimations();
        this.loadQuantitiesFromCart();
        setTimeout(() => this.setupHorizontalScroll(), 300);
      }
    );
  }
  
  // Load supermarket data (products and offers)
  private async loadSupermarketData(): Promise<{ products: any[], offerProducts: any[] }> {
    if (!this.selectedSupermarket) return { products: [], offerProducts: [] };
    const result = await this.homeService.loadSupermarketDataWithoutImages(this.selectedSupermarket.id, this.dataState, true, true);
    this.loadAvailableQuantities();
    return { products: result.products, offerProducts: result.offerProducts };
  }

  // Load available quantities for products
  private loadAvailableQuantities(): void {
    if (!this.selectedSupermarket) return;
    this.availableQuantities = this.homeService.ui.getAvailableQuantities(this.selectedSupermarket.id);
  }

  // Reload selected supermarket if available
  private reloadSM(): void {
    const selectedSupermarket = this.homeService.supermarkets.getSelectedSupermarket();
    if (selectedSupermarket && this.supermarkets.length > 0) {
      const supermarketExists = this.supermarkets.find(sm => sm.id === selectedSupermarket.id); 
      if (supermarketExists) {
        this.selectedSupermarket = supermarketExists;
        requestAnimationFrame(() => {
          this.centerSelectedSupermarket(supermarketExists);
          if (this.map) {
            this.homeService.map.selectSupermarketOnMap(supermarketExists, this.map, this.markers, false, 14);
          }
        });
        this.onSupermarketChange();
      } else {
        this.homeService.supermarkets.clearSelectedSupermarket();
      }
    }
  }

  // Generate categories from products
  private generateCategories(): void {
    const allProducts = [...this.products, ...this.offerProducts];
    const categories = this.homeService.products.generateCategories(allProducts);
    this.homeService.ui.updateCategories(this.dataState, categories);
  }

  // Handle category selection
  onCategorySelect(categoryName: string): void {
    this.homeService.ui.setSelectedCategory(this.dataState, categoryName);
    this.homeService.ui.showCategoryProducts(this.displayProducts, this.animationState);
  }

  // Handle quantity button click
  handleQuantityClick(barcode: string, amount: number, event: MouseEvent): void {
    event.preventDefault();
    this.updateQuantity(barcode, amount);
  }

  // Increment product quantity
  incrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, 1); 
  }
  
  // Decrement product quantity
  decrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, -1); 
  }

  // Increment button hold
  onIncrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  // Decrement button hold
  onDecrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, false, this.updateQuantity.bind(this));
  }

  // Button release
  onButtonRelease(): void { 
    this.homeService.ui.clearTimer();
  }

  // Update product quantity in cart
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
    let product = this.products.find(p => p.barcode === barcode);
    if (!product) {
      product = this.offerProducts.find(p => p.barcode === barcode);
    }
    return product;
  }

  // Load quantities from cart
  private loadQuantitiesFromCart(): void {
    this.quantities = {};
    if (!this.selectedSupermarket) return;
    const cartItems = this.homeService.cart.getCartItems();
    cartItems.forEach((item: any) => {
      if (item.supermarketId === this.selectedSupermarket?.id) {
        this.quantities[item.barcode] = item.quantity;
      }
    });
  }

  // Add product to cart from purchase history
  addToCartFromHistory(purchase: any): void {
    if (this.selectedSupermarket) {
      const product = {
        id: purchase.product_id,
        name: purchase.product_name,
        price: purchase.total_price / purchase.quantity,
        image_url: purchase.product_image_url
      };
      this.homeService.cart.updateCartItem(product, this.selectedSupermarket, 1);
    }
  }

  // Reset all product animations
  private resetAnimations(): void {
    this.homeService.ui.resetAnimations(this.animationState);
  }

  // Start product animations
  private startProductAnimations(): void {
    this.homeService.ui.showAllProducts(this.displayProducts, this.displayOfferProducts, this.animationState);
  }

  // Setup horizontal scroll
  private setupHorizontalScroll(): void {
    this.homeService.ui.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    
    const scrollableContainers = '.supermarkets-container, .products-container, .offers-container, .categories-container';
    const allListeners = this.homeService.ui.setupHorizontalScroll(scrollableContainers);
    this.scrollListeners = allListeners;
  }

  // Clean up listeners
  private cleanup(): void {
    this.homeService.ui.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    window.removeEventListener('listenSMSelectionSearch', this.searchListener as EventListener);
    if (this.map) {
      this.map.remove();
      this.map = undefined;
      this.markers = [];
      this.userMarker = undefined;
    }
  }

  // Navigate to create supermarket page
  onCreateSupermarket(): void {
    this.router.navigate(['/home/gestione/crea-supermercato']);
  }

  // Navigate to create product page
  onCreateProduct(): void {
    this.router.navigate(['/home/gestione/aggiungi-prodotto']);
  }

  // Navigate to products page
  navigateToProducts(): void {
    if (this.selectedSupermarket) {
      this.router.navigate(['/home/prodotti']);
    }
  }

  // Navigate to offers page
  navigateToOffers(): void {
    if (this.selectedSupermarket) {
      this.router.navigate(['/home/offerte']);
    }
  }

  // Get supermarket store image
  getSupermarketImage(name: string): string {
    return this.homeService.supermarkets.getStoreImage(name);
  }

  // Get distance from user position
  getDistanceFromUser(supermarket: Supermarket): string | null {
    return this.homeService.position.getDistanceFromUser(this.userPosition, supermarket.latitude, supermarket.longitude);
  }

  // Get category icon
  getCategoryIcon(category: string): string {
    return this.homeService.products.getCategoryIcon(category);
  }

  // Get display price for product
  getDisplayPrice(product: Product): number {
    return this.homeService.products.getDisplayPrice(product);
  }

  // Get original price for product
  getOriginalPrice(product: Product): number | null {
    return this.homeService.products.getOriginalPrice(product);
  }

  // Handle image loading errors
  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }

  // Format purchase date for display
  formatPurchaseDate(dateString: string): string {
    const adjusted = this.homeService.ui.adjustServerDate(dateString);
    return adjusted.toLocaleDateString('it-IT');
  }

  // Public view methods
  toggleHistoryView(): void {
    this.isHistoryView = true;
    this.loadQuantitiesFromCart();
  }

  toggleCartView(): void {
    this.isHistoryView = false;
    this.loadQuantitiesFromCart();
  }

  getCartTotal(): number {
    if (!this.viewContent || this.viewContent.length === 0) return 0;
    
    return this.viewContent.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  // Check if product is available in selected supermarket
  isProductAvailable(item: any): boolean {
    if (!this.isHistoryView) return true;
    if (!this.selectedSupermarket) return false;
    const barcode = item.product_barcode || item.barcode;
    if (!barcode) return false;
    const productExists = this.products.some(p => p.barcode === barcode);
    const offerExists = this.offerProducts.some(p => p.barcode === barcode);
    return productExists || offerExists;
  }

  // Filter history items to show available products
  getFilteredHistoryItems(items: any[]): any[] {
    if (!this.isHistoryView) return items;
    
    return items.filter(item => {
      const barcode = item.product_barcode || item.barcode;
      return [...this.products, ...this.offerProducts].some(p => p.barcode === barcode);
    });
  }

  // Get product image with caching
  getProductImage(barcode: string): string {
    if (!barcode) return 'assets/categories/packing.png';
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
    this.imageCache[barcode] = 'assets/categories/packing.png';
    return this.imageCache[barcode];
  }

  // Generate random offers
  async onGenerateOffer(): Promise<void> {
    if (!this.selectedSupermarket) {
      console.error('Nessun supermercato selezionato');
      this.showAlert('error', 'Errore', 'Seleziona un supermercato per generare le offerte');
      return;
    }

    try {
      this.isLoading = true;
      const response = await lastValueFrom(
        this.homeService.products.generateOffers(this.selectedSupermarket.id)
      );
      console.log('Offerte generate con successo:', response);
      const [products, offerProducts] = await Promise.all([
        this.homeService.products.loadSupermarketProducts(this.selectedSupermarket.id).then(products => {
          this.homeService.ui.updateInventoryFromProducts(products, this.selectedSupermarket!.id);
          return products;
        }),
        this.homeService.products.loadSupermarketOffers(this.selectedSupermarket.id)
      ]);
      this.homeService.ui.updateProducts(this.dataState, products);
      this.homeService.ui.updateOfferProducts(this.dataState, offerProducts);
      await this.loadSupermarkets();
      this.generateCategories();
      this.startProductAnimations();
      this.showAlert('success', 'Successo', 'Offerte generate con successo!');
    } catch (error) {
      console.error('Errore durante la generazione delle offerte:', error);
      this.showAlert('error', 'Errore', 'Si è verificato un errore durante la generazione delle offerte');
    } finally {
      this.isLoading = false;
    }
  }
}
