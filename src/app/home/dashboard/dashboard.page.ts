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
import { HomeService, Product, Category, PurchaseHistory } from '../home.service';
import { lastValueFrom } from 'rxjs';
import { Supermarket } from '../../services/supermercati/supermercati.service';
import { SupermarketDataState, AnimationState } from '../../services/ui/ui.service';
import { AuthService } from '../../auth/auth.service';
import { CarrelloService, CartItem } from '../../services/carrello/carrello.service';
import { ProdottiService } from '../../services/prodotti/prodotti.service';
import { UiService } from '../../services/ui/ui.service';
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
  
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @ViewChild('supermarketsContainer', { static: false }) supermarketsContainer!: ElementRef;
  
  // Supermarket Data
  supermarkets: Supermarket[] = [];
  selectedSupermarket: Supermarket | null = null;
  private dataState: SupermarketDataState = this.homeService.createDataState();
  
  // Loading States
  isLoading = false;
  isLocationLoading = false;
  
  // Location States
  userPosition: { lat: number; lng: number } | null = null;
  locationEnabled = false;
  
  // Map States
  isMapExpanded = true;
  private userExpandedMap = false;
  map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private userMarker: L.CircleMarker | undefined;
  
  // UI States
  private animationState = this.homeService.createAnimationState();
  private scrollListeners: Array<{ element: Element; listener: EventListener }> = [];
  private searchListener = (event: any) => {
    if (event.detail?.supermarket) {
      this.selectedSupermarket = event.detail.supermarket;
      requestAnimationFrame(() => {
        this.selectSupermarket(event.detail.supermarket);
      });
    }
  };
  
  isHistoryView = true;
  quantities: { [barcode: string]: number } = {};
  availableQuantities: { [barcode: string]: number } = {};
  private activeBarcode: string | null = null;
  
  // Cache per le immagini già caricate
  private imageCache: {[key: string]: string} = {};
  
  // Getters
  get products() { return this.dataState.products; }
  get offerProducts() { return this.dataState.offerProducts; }
  get categories() { return this.dataState.categories; }
  get selectedCategory() { return this.dataState.selectedCategory; }
  get filteredProducts() { 
    return this.homeService.filterProductsByCategory(this.products, this.selectedCategory);
  }
  get filteredOfferProducts() {
    return this.homeService.filterProductsByCategory(this.offerProducts, this.selectedCategory);
  }
  get purchaseHistory() { return this.dataState.purchaseHistory; }
  get displayProducts() { return this.filteredProducts.slice(0, 8); }
  get displayOfferProducts() { return this.filteredOfferProducts.slice(0, 8); }
  get canCreateContent() { return this.homeService.isUserAdmin() || this.homeService.isUserManager(); }
  
  // Alert properties
  showCustomAlert = false;
  alertType: 'success' | 'error' = 'success';
  alertTitle = '';
  alertMessage = '';
  
  // Get the appropriate icon based on alert type
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
  
  // Genera offerte casuali per il supermercato selezionato
  async onGenerateOffer() {
    if (!this.selectedSupermarket) {
      console.error('Nessun supermercato selezionato');
      this.showAlert('error', 'Errore', 'Seleziona un supermercato per generare le offerte');
      return;
    }
    
    try {
      this.isLoading = true;
      const response = await lastValueFrom(
        this.homeService.generateOffers(this.selectedSupermarket.id)
      );
      console.log('Offerte generate con successo:', response);
      const [products, offerProducts] = await Promise.all([
        this.prodottiService.loadSupermarketProducts(this.selectedSupermarket.id),
        this.prodottiService.loadSupermarketOffers(this.selectedSupermarket.id)
      ]);
      this.homeService.updateProducts(this.dataState, products);
      this.homeService.updateOfferProducts(this.dataState, offerProducts);
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
  
  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    private router: Router,
    private carrelloService: CarrelloService,
    private prodottiService: ProdottiService,
    private uiService: UiService
  ) {
    addIcons({ add, remove, storefront, location, checkmarkCircle, chevronForwardOutline, map, chevronUp, chevronDown, cart });
  }

  toggleHistoryView() {
    this.isHistoryView = true;
    this.loadQuantitiesFromCart();
  }

  toggleCartView() {
    this.isHistoryView = false;
    this.loadQuantitiesFromCart();
  }

  getCartTotal(): number {
    if (!this.viewContent || this.viewContent.length === 0) return 0;
    
    return this.viewContent.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  // Verifica se un prodotto è disponibile (sia in offerta che non)
  isProductAvailable(item: any): boolean {
    if (!this.isHistoryView) return true;
    if (!this.selectedSupermarket) return false;
    const barcode = item.product_barcode || item.barcode;
    if (!barcode) return false;
    const productExists = this.products.some(p => p.barcode === barcode);
    const offerExists = this.offerProducts.some(p => p.barcode === barcode);
    return productExists || offerExists;
  }

  removeFromCart(item: CartItem) {
    this.carrelloService.removeFromCart(item.id, item.supermarketId);
    if (this.quantities[item.barcode]) {
      this.quantities[item.barcode] = 0;
    }
  }

  // Filter history items to only show available products
  getFilteredHistoryItems(items: any[]): any[] {
    if (!this.isHistoryView) return items;
    
    return items.filter(item => {
      const barcode = item.product_barcode || item.barcode;
      return [...this.products, ...this.offerProducts].some(p => p.barcode === barcode);
    });
  }

  // Usa una cache in memoria per evitare chiamate ripetute
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

  get viewContent() {
    return this.isHistoryView ? this.purchaseHistory : this.carrelloService.getCartItems();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    if (this.selectedSupermarket) {
      requestAnimationFrame(() => this.centerSelectedSupermarket(this.selectedSupermarket!));
    }
  }

  async ngOnInit() {
    await this.initializeComponent();
  }

  ngAfterViewInit() {
    setTimeout(() => this.setupHorizontalScroll(), 500);
    if (this.isMapExpanded && !this.map) {
      requestAnimationFrame(() => this.initMap());
    }
  }

  ngOnDestroy() {
    this.homeService.clearQuantityTimer();
    this.cleanup();
    window.removeEventListener('listenSMSelectionSearch', this.searchListener as EventListener);
  }

  ionViewWillEnter() {
    if (this.selectedSupermarket) {
      requestAnimationFrame(() => this.centerSelectedSupermarket(this.selectedSupermarket!));
    }
    this.loadQuantitiesFromCart();
  }

  // Init Methods
  private async initializeComponent(): Promise<void> {
    this.listenSMSelection();
    this.setupSearchListener();
    await this.loadPurchaseHistory();
    await this.initializeUserLocation();
    await this.loadSupermarkets();
    this.autoExpandMapIfNeeded();
    this.reloadSM();
  }

  private listenSMSelection() {
    this.homeService.selectedSupermarket$.subscribe(this.handleSupermarketSelection.bind(this));
  }  
  


  private setupSearchListener(): void {
    window.addEventListener('listenSMSelectionSearch', this.searchListener as EventListener);
  }

  private async loadPurchaseHistory(): Promise<void> {
    const purchaseHistory = this.canCreateContent ? [] : await this.homeService.loadPurchaseHistory(5);
    this.homeService.updatePurchaseHistory(this.dataState, purchaseHistory);
  }

  //Location Management
  private async initializeUserLocation(): Promise<void> {
    try {
      const position = await this.homeService.getCurrentPosition();
      if (position) {
        this.userPosition = position;
        this.locationEnabled = true;
        this.updateMapWithUserLocation();
      }
    } catch (error) {}
  }

  async enableLocationAndCenter(): Promise<void> {
    if (this.isLocationLoading) return;
    this.isLocationLoading = true;
    try {
      if (this.locationEnabled && this.userPosition) {
        if (this.map) {
          this.homeService.centerOnUserPosition(this.map, this.userPosition, 15);
        }
        return;
      }
      const position = await this.homeService.getCurrentPosition();
      if (position) {
        this.userPosition = position;
        this.locationEnabled = true;
        this.updateMapWithUserLocation();
        if (this.map) {
          this.homeService.centerOnUserPosition(this.map, position, 15);
        }
      }
    } catch (error) {
    } finally {
      this.isLocationLoading = false;
    }
  }

  private updateMapWithUserLocation(): void {
    const hasSupermarkets = this.supermarkets.length > 0;
    const hasMap = !!this.map;
    const hasUserPosition = !!this.userPosition;
    
    if (hasSupermarkets && hasUserPosition) {
      this.sortSupermarketsByDistance();
    }
    if (hasMap) {
      if (hasUserPosition) {
        this.homeService.centerOnUserPosition(this.map!, this.userPosition!, 13);
      }
      this.setupMapMarkers();
    }
    if (hasSupermarkets && hasUserPosition) {
      setTimeout(() => this.setupHorizontalScroll(), 500);
    }
  }

  private sortSupermarketsByDistance(): void {
    if (!this.userPosition) return;
    
    this.supermarkets = this.homeService.sortByDistance(
      this.supermarkets, 
      this.userPosition.lat, 
      this.userPosition.lng
    );
  }

  // Map Management
  private initMap(): void {
    if (this.map || !this.mapContainer) return;
    try {
      const mapCenter: [number, number] = this.userPosition 
        ? [this.userPosition.lat, this.userPosition.lng] 
        : [41.9028, 12.4964];
      const mapZoom = this.userPosition ? 13 : 6;
      
      this.map = this.homeService.initializeMap(this.mapContainer.nativeElement, {
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
          this.homeService.centerOnUserPosition(this.map, this.userPosition, 13);
        }
      }
    } catch (error) {}
  }

  private setupMapMarkers(): void {
    this.homeService.completeMapSetup(
      this.map!,
      this.userPosition || undefined,
      this.supermarkets,
      (supermarket) => this.selectSupermarket(supermarket),
      (userMarker) => this.userMarker = userMarker,
      (markers) => this.markers = markers
    );
  }

  toggleMap() {
    this.isMapExpanded = !this.isMapExpanded;
    this.userExpandedMap = this.isMapExpanded;
    this.handleMapExpansion();
  }
  
  private autoExpandMapIfNeeded(): void {
    if (!this.selectedSupermarket && !this.isMapExpanded && this.supermarkets.length > 0) {
      this.isMapExpanded = true;
      this.userExpandedMap = false;
      this.handleMapExpansion();
    }
  }

  private handleMapExpansion(): void {
    if (!this.isMapExpanded) return;
    requestAnimationFrame(() => {
      this.map ? this.map.invalidateSize() : this.initMap();
    });
  }

  // Supermarket Management
  private async loadSupermarkets() {
    await this.homeService.executeWithLoading(
      (loading) => this.isLoading = loading,
      async () => {        
        this.supermarkets = await this.homeService.loadAndSetupSupermarkets(this.userPosition || undefined);
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

  private handleSupermarketSelection(supermarket: Supermarket | null) {
    const isDifferentSupermarket = supermarket?.id !== this.selectedSupermarket?.id;
    if (supermarket && isDifferentSupermarket) {
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

  selectSupermarket(supermarket: Supermarket) {
    this.quantities = {}; 
    this.carrelloService.clearCart();

    this.homeService.setSelectedSupermarket(supermarket);
    this.homeService.selectSupermarketOnMap(supermarket, this.map, this.markers, false, 14);
    if (this.isMapExpanded && !this.userExpandedMap) {
      this.isMapExpanded = false;
    }
    this.centerSelectedSupermarket(supermarket);
    this.loadQuantitiesFromCart();
    setTimeout(() => this.setupHorizontalScroll(), 300);
  }

  private centerSelectedSupermarket(selectedSupermarket: Supermarket) {
    this.homeService.centerSelectedItem(
      this.supermarkets,
      selectedSupermarket, 
      this.supermarketsContainer
    );
    if (this.map) {
      this.homeService.selectSupermarketOnMap(selectedSupermarket, this.map, this.markers, false, 16, 0.5);
    }
  }

  async onSupermarketChange() {
    if (!this.selectedSupermarket) {
      this.homeService.clearSupermarketData(this.dataState);
      this.resetAnimations();
      return;
    }
    if (this.dataState.selectedCategory) {
      this.dataState.selectedCategory = '';
    }
    await this.homeService.executeWithLoading(
      (loading) => this.isLoading = loading,
      async () => {
        this.resetAnimations();
        const { products, offerProducts } = await this.loadSupermarketData();
        const allProducts = [...products, ...offerProducts];
        if (allProducts.length > 0) {
          await this.homeService.loadImagesForLoadedProducts(allProducts);
        }
        this.generateCategories();
        this.startProductAnimations();
        this.loadQuantitiesFromCart();
        setTimeout(() => this.setupHorizontalScroll(), 300);
      }
    );
  }
  
  private async loadSupermarketData(): Promise<{ products: any[], offerProducts: any[] }> {
    if (!this.selectedSupermarket) return { products: [], offerProducts: [] };
    const result = await this.homeService.loadSupermarketDataWithoutImages(this.selectedSupermarket.id, this.dataState, true, true);
    
    // Carica le quantità disponibili
    this.loadAvailableQuantities();
    
    return { products: result.products, offerProducts: result.offerProducts };
  }

  private loadAvailableQuantities(): void {
    if (!this.selectedSupermarket) return;
    this.availableQuantities = this.homeService.getAvailableQuantities(this.selectedSupermarket.id);
  }

  private reloadSM() {
    const selectedSupermarket = this.homeService.getSelectedSupermarket();
    if (selectedSupermarket && this.supermarkets.length > 0) {
      const supermarketExists = this.supermarkets.find(sm => sm.id === selectedSupermarket.id); 
      if (supermarketExists) {
        this.selectedSupermarket = supermarketExists;
        requestAnimationFrame(() => {
          this.centerSelectedSupermarket(supermarketExists);
          if (this.map) {
            this.homeService.selectSupermarketOnMap(supermarketExists, this.map, this.markers, false, 14);
          }
        });
        this.onSupermarketChange();
      } else {
        this.homeService.clearSelectedSupermarket();
      }
    }
  }

  // Product Management
  private generateCategories() {
    const allProducts = [...this.products, ...this.offerProducts];
    const categories = this.homeService.generateCategories(allProducts);
    this.homeService.updateCategories(this.dataState, categories);
  }

  onCategorySelect(categoryName: string) {
    this.homeService.setSelectedCategory(this.dataState, categoryName);
    this.homeService.startCategoryAnimation(this.displayProducts, this.animationState);
  }

  // Gestione quantità
  handleQuantityClick(barcode: string, amount: number, event: MouseEvent) {
    event.preventDefault();
    this.updateQuantity(barcode, amount);
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
    cartItems.forEach(item => {
      if (item.supermarketId === this.selectedSupermarket?.id) {
        this.quantities[item.barcode] = item.quantity;
      }
    });
  }

  addToCartFromHistory(purchase: any) {
    if (this.selectedSupermarket) {
      const product = {
        id: purchase.product_id,
        name: purchase.product_name,
        price: purchase.total_price / purchase.quantity,
        image_url: purchase.product_image_url
      };
      this.homeService.addToCart(product, this.selectedSupermarket);
    }
  }

  // Animation Management
  private resetAnimations() {
    this.homeService.resetAnimations(this.animationState);
  }

  private startProductAnimations() {
    this.homeService.startAllProductAnimations(this.displayProducts, this.displayOfferProducts, this.animationState);
  }

  //UI Management
  private setupHorizontalScroll(): void {
    this.homeService.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    
    const scrollableContainers = '.supermarkets-container, .products-container, .offers-container, .categories-container';
    const allListeners = this.homeService.setupHorizontalScroll(scrollableContainers);
    this.scrollListeners = allListeners;
  }

  // Cleanup Management
  private cleanup() {
    this.homeService.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    window.removeEventListener('listenSMSelectionSearch', this.searchListener as EventListener);
    if (this.map) {
      this.map.remove();
      this.map = undefined;
      this.markers = [];
      this.userMarker = undefined;
    }
  }

  // Navigation Methods
  onCreateSupermarket() {
    this.router.navigate(['/home/gestione/crea-supermercato']);
  }

  onCreateProduct() {
    this.router.navigate(['/home/gestione/aggiungi-prodotto']);
  }

  navigateToProducts() {
    if (this.selectedSupermarket) {
      this.router.navigate(['/home/prodotti']);
    }
  }

  navigateToOffers() {
    if (this.selectedSupermarket) {
      this.router.navigate(['/home/offerte']);
    }
  }

  //Utility Methods
  getSupermarketImage(name: string): string {
    return this.homeService.getStoreImage(name);
  }

  getDistanceFromUser(supermarket: Supermarket): string | null {
    return this.homeService.getDistanceFromUser(this.userPosition, supermarket.latitude, supermarket.longitude);
  }

  getCategoryIcon(category: string): string {
    return this.homeService.getCategoryIcon(category);
  }

  getDisplayPrice(product: Product): number {
    return this.homeService.getDisplayPrice(product);
  }

  getOriginalPrice(product: Product): number | null {
    return this.homeService.getOriginalPrice(product);
  }

  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }

  formatPurchaseDate(dateString: string): string {
    return this.uiService.formatServerDateShort(dateString);
  }
}
