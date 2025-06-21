import { Component, OnInit, HostListener, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonIcon, IonGrid, IonRow, IonCol,
  IonList, IonItem, IonLabel, IonSpinner, IonText,
  IonImg, IonBadge, IonFabButton, IonButton
} from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, storefront, location, checkmarkCircle, chevronForwardOutline, map, chevronUp, chevronDown } from 'ionicons/icons';
import { HomeService, Supermarket, SupermarketDataState } from '../home.service';
import { AuthService } from '../../auth/auth.service';
import * as L from 'leaflet';

export interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  on_offer: boolean;
  offer_price?: number;
  image_url?: string;
  barcode?: string;
}

export interface Category {
  name: string;
  icon: string;
  count: number;
}

export interface PurchaseHistory {
  id: number;
  product_name: string;
  supermarket_name: string;
  quantity: number;
  total_price: number;
  purchase_date: string;
}



@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,  imports: [
    IonContent, IonIcon, IonGrid, IonRow, IonCol,
    IonList, IonItem, IonLabel, IonSpinner, IonText,
    IonImg, IonBadge, IonFabButton, IonButton,
    CommonModule, FormsModule
  ]
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy, ViewWillEnter {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @ViewChild('supermarketsContainer', { static: false }) supermarketsContainer!: ElementRef;
  supermarkets: Supermarket[] = [];
  selectedSupermarket: Supermarket | null = null;
  
  // Data state - now managed by service
  private dataState: SupermarketDataState = this.homeService.createDataState();
  
  // Getters for template access
  get products() { return this.dataState.products; }
  get offerProducts() { return this.dataState.offerProducts; }
  get categories() { return this.dataState.categories; }
  get selectedCategory() { return this.dataState.selectedCategory; }
  get filteredProducts() { return this.dataState.filteredProducts; }
  get purchaseHistory() { return this.dataState.purchaseHistory; }
    // Loading states
  isLoading = false;
  
  get productsLoading() { return this.animationState.productsLoading; }
  get offersLoading() { return this.animationState.offersLoading; }
  
  // Image loading progress
  imageLoadingProgress = {
    show: false,
    current: 0,
    total: 0,
    type: '' as 'barcode' | 'name' | ''
  };

  // Animation state - now managed by service
  private animationState = this.homeService.createAnimationState();
    isLargeScreen = false;
  canCreateSupermarket = false;
  showCreateCard = false;
  showCreateProductCard = false;
  userPosition: { lat: number; lng: number } | null = null;
  
  isMapExpanded = true;
  private userExpandedMap = false;
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private userMarker: L.CircleMarker | undefined;
  mapInitialized = false;
  private mapCenteredOnUser = false;
  private loadingTimeout: any = null;
  private scrollListeners: Array<{ element: Element; listener: EventListener }> = [];
  private searchListener: EventListener | null = null;

  // User role getters
  get isUserCustomer() { 
    const user = this.authService.getUser();
    return HomeService.isCustomer(user);
  }
  // Location state
  locationPermissionRequested = false;
  locationEnabled = false;
  isLocationLoading = false;
  
  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ add, storefront, location, checkmarkCircle, chevronForwardOutline, map, chevronUp, chevronDown });
  }@HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
    
    // Re-center selected supermarket after resize to ensure it stays centered
    if (this.selectedSupermarket) {
      setTimeout(() => {
        this.centerSelectedSupermarket(this.selectedSupermarket!);
      }, 200);
    }
  }  async ngOnInit() {
    this.checkScreenSize();
    this.checkUserRole();
    this.subscribeToSupermarketChanges();
    this.setupSearchListener();
    await Promise.all([
      ...(this.isUserCustomer ? [this.loadPurchaseHistory()] : [])
    ]);
    await this.loadSupermarkets();
    this.autoExpandMapIfNeeded();
    this.recenterSelectedSupermarketAfterLoad();    // Expose test methods to global scope for debugging
    (window as any).testImageSearch = {
      barcode: (barcode: string) => this.testBarcodeSearch(barcode),
      name: (name: string) => this.testNameSearch(name),
      runTests: () => this.runImageSearchTests(),
      testUnified: () => this.homeService.testUnifiedImageLoading(),
      rateLimits: () => console.log(this.getRateLimitStatus()),
      resetLimits: () => this.resetImageRateLimits(),
      analyzeBarcodes: () => this.analyzeProductBarcodes(),
      analyzeDeduplication: () => {
        const allProducts = [...this.products, ...this.offerProducts];
        const analysis = this.homeService.analyzeProductDeduplication(allProducts);
        console.log('🔍 Analisi Deduplicazione Dettagliata:', analysis);
        return analysis;
      }
    };
    
    console.log('🔧 Debug methods available:');
    console.log('- testImageSearch.barcode("8076800195057") - Test barcode search');
    console.log('- testImageSearch.name("Nutella") - Test name search');  
    console.log('- testImageSearch.runTests() - Run all tests');
    console.log('- testImageSearch.testUnified() - Test unified loading system');
    console.log('- testImageSearch.rateLimits() - Check rate limit status');
    console.log('- testImageSearch.resetLimits() - Reset rate limits');
    console.log('- testImageSearch.analyzeBarcodes() - Analyze current products barcodes');
    console.log('- testImageSearch.analyzeDeduplication() - Detailed deduplication analysis');
  }
  ngAfterViewInit() {
    this.setupHorizontalScroll();
    
    // Initialize map if it's already expanded
    if (this.isMapExpanded && !this.mapInitialized) {
      setTimeout(() => this.initMap(), 100);
    }
  }

  ngOnDestroy() {
    this.cleanup();
  }

  ionViewWillEnter() {
    if (this.selectedSupermarket && this.supermarkets.length > 0) {
      setTimeout(() => {
        this.centerSelectedSupermarket(this.selectedSupermarket!);
      }, 200);
    }
  }

  // initialization
  private subscribeToSupermarketChanges() {
    this.homeService.selectedSupermarket$.subscribe(supermarket => {
      this.handleSupermarketSelection(supermarket);
    });
  }  private setupSearchListener() {
    this.searchListener = (event: any) => {
      const { supermarket } = event.detail;
      if (supermarket) {
        this.selectedSupermarket = supermarket;
        setTimeout(() => {
          this.centerSelectedSupermarket(supermarket);
          this.selectSupermarket(supermarket);
        }, 100);
      }
    };
    window.addEventListener('supermarketSelectedFromSearch', this.searchListener);
  }
  private async initializeUserLocation(): Promise<void> {
    // This method is now called only by user action through enableLocationAndCenter()
    try {
      const position = await this.homeService.getCurrentPosition();
      if (position) {
        this.userPosition = position;
        this.locationEnabled = true;
        this.updateMapWithUserLocation();
      }
    } catch (error) {
      console.warn('Error getting location:', error);
    }
  }// Method to be called by geolocation button to enable location and center map
  async enableLocationAndCenter(): Promise<void> {
    if (this.isLocationLoading) return;
    
    this.isLocationLoading = true;
    
    try {
      // If location is already enabled, just center on current position
      if (this.locationEnabled && this.userPosition) {
        if (this.mapInitialized && this.map) {
          this.homeService.centerOnUserPosition(this.map, this.userPosition, 15);
        }
        return;
      }
      
      // Otherwise, request location permission
      this.locationPermissionRequested = true;
      const position = await this.homeService.getCurrentPosition();
      
      if (position) {
        this.userPosition = position;
        this.locationEnabled = true;
        this.updateMapWithUserLocation();
        
        // Center map on user position if map is initialized
        if (this.mapInitialized && this.map) {
          this.homeService.centerOnUserPosition(this.map, position, 15);
          this.mapCenteredOnUser = true;
        }
      }
    } catch (error) {
      console.warn('Error getting location:', error);
    } finally {
      this.isLocationLoading = false;
    }
  }

  private updateMapWithUserLocation() {
    if (this.supermarkets.length > 0) {
      this.sortSupermarketsByDistance();
    }
    
    if (this.mapInitialized && this.map && this.userPosition) {
      // Center only if this is the first time we get user position
      if (!this.mapCenteredOnUser) {
        this.homeService.centerOnUserPosition(this.map, this.userPosition, 13);
        this.mapCenteredOnUser = true;
      }
      this.setupMapMarkers();
    } else if (this.mapInitialized && this.map) {
      this.setupMapMarkers();
    }
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
      // Auto-expand map when no supermarket is selected
      this.autoExpandMapIfNeeded();
      this.onSupermarketChange();
    }
  }

  // cleanup
  private cleanup() {
    this.homeService.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
    if (this.searchListener) {
      window.removeEventListener('supermarketSelectedFromSearch', this.searchListener);
      this.searchListener = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = undefined;
      this.mapInitialized = false;
      this.mapCenteredOnUser = false;
      this.markers = [];
      this.userMarker = undefined;
    }
  }

  // horizontal scroll
  private setupHorizontalScroll() {
    this.homeService.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    const desktopListeners = this.homeService.setupHorizontalScroll('.supermarkets-container:not(.mobile)');
    const mobileListeners = this.homeService.setupHorizontalScroll('.supermarkets-container.mobile');
    this.scrollListeners = [...desktopListeners, ...mobileListeners];
  }

  // Screen size and user role methods
  private checkScreenSize() {
    this.isLargeScreen = this.homeService.checkScreenSize();
  }

  private checkUserRole() {
    this.canCreateSupermarket = this.homeService.canCreateSupermarket();
    this.updateCreateCardVisibility();
  }
  private updateCreateCardVisibility() {
    if (!this.canCreateSupermarket) {
      this.showCreateCard = false;
      return;
    }

    this.showCreateCard = this.homeService.isUserAdmin() || this.homeService.isUserManager();
    this.updateCreateProductCardVisibility();
  }

  private updateCreateProductCardVisibility() {
    // Solo admin e manager possono creare prodotti, e solo se c'è un supermercato selezionato
    this.showCreateProductCard = 
      (this.homeService.isUserAdmin() || this.homeService.isUserManager()) && 
      !!this.selectedSupermarket;
  }

  // Map methods
  private setupMapMarkers() {
    const setupResult = this.homeService.completeMapSetup(
      this.map!,
      this.userPosition || undefined,
      this.supermarkets,
      (supermarket) => this.selectSupermarket(supermarket),
      (userMarker) => this.userMarker = userMarker,
      (markers) => this.markers = markers
    );
  }
  //sort supermarket
  private sortSupermarketsByDistance() {
    if (!this.userPosition) return;
    
    this.supermarkets = this.homeService.sortByDistance(
      this.supermarkets, 
      this.userPosition.lat, 
      this.userPosition.lng
    );  }  // leaflet
  private initMap() {
    if (this.mapInitialized || !this.mapContainer) return;
    
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
        this.mapInitialized = true;
        this.setupMapMarkers();
        
        if (this.userPosition && !this.mapCenteredOnUser) {
          this.homeService.centerOnUserPosition(this.map, this.userPosition, 13);
          this.mapCenteredOnUser = true;
        }
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      this.mapInitialized = false;
    }
  }
    // supermarket selection
  selectSupermarket(supermarket: Supermarket) {
    this.homeService.setSelectedSupermarket(supermarket);
    this.homeService.selectSupermarketOnMap(supermarket, this.map, this.markers, false, 14);
    if (this.isMapExpanded && !this.userExpandedMap) {
      this.isMapExpanded = false;
    }
    this.centerSelectedSupermarket(supermarket);
    this.updateCreateProductCardVisibility();
    setTimeout(() => this.setupHorizontalScroll(), 200);  }
  
  // Map toggle methods
  toggleMap() {
    this.isMapExpanded = !this.isMapExpanded;
    if (this.isMapExpanded) {
      this.userExpandedMap = true;
    } else {
      this.userExpandedMap = false;
    }
    
    if (this.isMapExpanded && !this.mapInitialized) {
      setTimeout(() => this.initMap(), 100);    } else if (this.isMapExpanded && this.mapInitialized && this.map) {
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 100);
    }
  }
    // Auto-expand map
  private autoExpandMapIfNeeded() {
    if (!this.selectedSupermarket && !this.isMapExpanded && this.supermarkets.length > 0) {
      this.isMapExpanded = true;
      this.userExpandedMap = false;
      
      if (!this.mapInitialized) {
        setTimeout(() => this.initMap(), 100);
      } else if (this.map) {
        setTimeout(() => this.map?.invalidateSize(), 100);
      }
    }
  }  // center selected supermarket
  private centerSelectedSupermarket(selectedSupermarket: Supermarket) {
    this.homeService.centerSelectedItem(
      this.supermarkets, 
      selectedSupermarket, 
      this.supermarketsContainer
    );
  }

  private getActiveContainer(): HTMLElement | null {
    return this.homeService.getActiveContainer(this.supermarketsContainer);
  }

  private scrollToSelectedCard(container: HTMLElement, selectedCard: HTMLElement) {
    this.homeService.scrollToSelectedCard(container, selectedCard);
  }

  // supermarket loading
  private async loadSupermarkets() {
    await this.homeService.executeWithLoading(
      (loading) => this.isLoading = loading,
      async () => {        
        this.supermarkets = await this.homeService.loadAndSetupSupermarkets(
          false, 
          undefined, 
          this.userPosition || undefined
        );
        if (this.userPosition) {
          this.sortSupermarketsByDistance();
        }
        this.updateCreateCardVisibility();
        setTimeout(() => this.setupHorizontalScroll(), 100);
        if (this.mapInitialized && this.map) {
          this.setupMapMarkers();
        }
        this.recenterSelectedSupermarketAfterLoad();
        
        return this.supermarkets;
      }
    );
  }  // supermarket change handler
  async onSupermarketChange() {
    if (!this.selectedSupermarket) {
      this.clearSupermarketData();
      return;
    }

    this.resetAnimations();
    this.isLoading = true;
    this.imageLoadingProgress.show = false;    try {
      // Load products and offers data first WITHOUT loading images
      const [products, offerProducts] = await Promise.all([
        this.loadProductsWithoutImages(),
        this.loadOffersWithoutImages()
      ]);
        // Combine all products and load images ONCE for all unique barcodes
      const allProducts = [...products, ...offerProducts];
      if (allProducts.length > 0) {
        console.log(`🎯 Loading images UNIFIED for ${allProducts.length} total products`);
        await this.homeService.loadImagesForLoadedProducts(allProducts);
      }
      
      // Analyze barcode availability for debugging
      this.analyzeProductBarcodes();
      
      // Show rate limit info for debugging
      if (products.length > 0 || offerProducts.length > 0) {
        const rateLimitInfo = this.homeService.getRateLimitInfo();
        console.log('Rate limit info:', rateLimitInfo);
        console.log('Status rate limits:', this.getRateLimitStatus());
      }
      
      this.generateCategories();
      this.startProductAnimations();
    } catch (error) {
      console.error('Error loading supermarket data:', error);
    } finally {
      this.isLoading = false;
    }
  }// clear supermarket
  private clearSupermarketData() {
    this.homeService.clearSupermarketData(this.dataState);
    this.resetAnimations();
  }  // load products
  private async loadProducts(): Promise<any[]> {
    if (!this.selectedSupermarket) return [];
    const products = await this.homeService.loadSupermarketProducts(this.selectedSupermarket.id);
    this.homeService.updateProducts(this.dataState, products);
    return products;
  }  // load offers
  private async loadOffers(): Promise<any[]> {
    if (!this.selectedSupermarket) return [];
    const offerProducts = await this.homeService.loadSupermarketOffers(this.selectedSupermarket.id);
    this.homeService.updateOfferProducts(this.dataState, offerProducts);
    return offerProducts;
  }

  // load products WITHOUT images
  private async loadProductsWithoutImages(): Promise<any[]> {
    if (!this.selectedSupermarket) return [];
    const products = await this.homeService.loadSupermarketProductsWithoutImages(this.selectedSupermarket.id);
    this.homeService.updateProducts(this.dataState, products);
    return products;
  }

  // load offers WITHOUT images
  private async loadOffersWithoutImages(): Promise<any[]> {
    if (!this.selectedSupermarket) return [];
    const offerProducts = await this.homeService.loadSupermarketOffersWithoutImages(this.selectedSupermarket.id);
    this.homeService.updateOfferProducts(this.dataState, offerProducts);
    return offerProducts;
  }

  // ...existing code...
  // load categories
  private generateCategories() {
    const categories = this.homeService.generateCategories(this.products);
    this.homeService.updateCategories(this.dataState, categories);
  }  private async loadPurchaseHistory() {
    if (!this.isUserCustomer) {
      this.homeService.updatePurchaseHistory(this.dataState, []);
      return;
    }
    const purchaseHistory = await this.homeService.loadPurchaseHistory(5);
    this.homeService.updatePurchaseHistory(this.dataState, purchaseHistory);
  }  // Navigation methods
  onCreateSupermarket() {
    this.router.navigate(['/crea/crea-supermercato']);
  }
  onCreateProduct() {
    this.router.navigate(['/crea/crea-prodotto']);
  }// Product and category methods
  onCategorySelect(categoryName: string) {
    this.homeService.setSelectedCategory(this.dataState, categoryName);
    const filteredProducts = this.homeService.filterProductsByCategory(this.products, categoryName);
    this.homeService.updateFilteredProducts(this.dataState, filteredProducts);
    this.homeService.startCategoryAnimation(this.filteredProducts, this.animationState);
  }// add to cart
  addToCart(product: Product) {
    if (this.selectedSupermarket) {
      this.homeService.addToCart(product, this.selectedSupermarket);
    }
  }// animation
  private resetAnimations() {
    this.homeService.resetAnimations(this.animationState);
  }

  private startProductAnimations() {
    this.homeService.startAllProductAnimations(this.filteredProducts, this.offerProducts, this.animationState);
  }

  private startOffersAnimation() {
    this.homeService.startOffersAnimation(this.offerProducts, this.animationState);
  }

  private startProductsAnimation() {
    this.homeService.startProductsAnimation(this.filteredProducts, this.offerProducts, this.animationState);
  }

  isProductAnimated(productId: number): boolean {
    return this.homeService.isProductAnimated(productId, this.animationState);
  }

  isOfferAnimated(productId: number): boolean {
    return this.homeService.isOfferAnimated(productId, this.animationState);
  }

  // Essential utility methods for template
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

  private recenterSelectedSupermarketAfterLoad() {
    const selectedSupermarket = this.homeService.getSelectedSupermarket();
    if (selectedSupermarket && this.supermarkets.length > 0) {
      const supermarketExists = this.supermarkets.find(sm => sm.id === selectedSupermarket.id); 
      if (supermarketExists) {
        this.selectedSupermarket = supermarketExists;
        setTimeout(() => {
          this.centerSelectedSupermarket(supermarketExists);
        }, 200);
        if (this.mapInitialized && this.map) {
          this.homeService.selectSupermarketOnMap(supermarketExists, this.map, this.markers, false, 14);
        }
        this.onSupermarketChange();
      } else {
        this.homeService.clearSelectedSupermarket();
      }
    }
  }

  // Rate limit and image loading utilities
  getRateLimitStatus(): string {
    const info = this.homeService.getRateLimitInfo();
    const canLoad = this.homeService.canLoadImages();
    
    if (!canLoad.barcode && !canLoad.search) {
      return 'Rate limit raggiunto per tutte le ricerche';
    } else if (!canLoad.barcode) {
      return `Rate limit raggiunto per ricerca barcode (${info.productRequests.remaining} rimanenti per ricerca nome)`;
    } else if (!canLoad.search) {
      return `Rate limit raggiunto per ricerca nome (${info.productRequests.remaining} rimanenti per barcode)`;
    } else {
      return `Richieste disponibili: ${info.productRequests.remaining} barcode, ${info.searchRequests.remaining} nome`;
    }
  }
  
  // Debug method to reset rate limits
  resetImageRateLimits(): void {
    this.homeService.resetRateLimits();
    console.log('Rate limits resettati');
  }
  // Utility method to analyze products and their barcode availability
  analyzeProductBarcodes(): void {
    if (!this.selectedSupermarket) return;
    
    const allProducts = [...this.products, ...this.offerProducts];
    const withBarcode = allProducts.filter(p => p.barcode && p.barcode.trim());
    const withoutBarcode = allProducts.filter(p => !p.barcode || !p.barcode.trim());
    
    // Analisi deduplicazione
    const deduplicationAnalysis = this.homeService.analyzeProductDeduplication(allProducts);
    
    console.log(`Analisi prodotti supermercato "${this.selectedSupermarket.name}":`);
    console.log(`- Prodotti con barcode: ${withBarcode.length}`);
    console.log(`- Prodotti senza barcode: ${withoutBarcode.length}`);
    console.log(`- Totale prodotti: ${allProducts.length}`);
    
    console.log(`\n📊 Analisi Deduplicazione:`);
    console.log(`- Prodotti con barcode unici: ${deduplicationAnalysis.withBarcode.unique} (su ${deduplicationAnalysis.withBarcode.total})`);
    console.log(`- Risparmi richieste barcode: ${deduplicationAnalysis.withBarcode.duplicates} richieste evitate`);
    
    if (Object.keys(deduplicationAnalysis.withBarcode.duplicatesByBarcode).length > 0) {
      console.log(`- Barcode duplicati:`, deduplicationAnalysis.withBarcode.duplicatesByBarcode);
    }
    
    console.log(`- Prodotti senza barcode unici: ${deduplicationAnalysis.withoutBarcode.unique} (su ${deduplicationAnalysis.withoutBarcode.total})`);
    console.log(`- Risparmi richieste nome: ${deduplicationAnalysis.withoutBarcode.duplicates} richieste evitate`);
    
    if (Object.keys(deduplicationAnalysis.withoutBarcode.duplicatesByName).length > 0) {
      console.log(`- Nomi duplicati:`, deduplicationAnalysis.withoutBarcode.duplicatesByName);
    }
    
    const totalSavings = deduplicationAnalysis.withBarcode.duplicates + deduplicationAnalysis.withoutBarcode.duplicates;
    console.log(`\n💰 Totale richieste API risparmiate: ${totalSavings}`);
    
    if (withBarcode.length > 0) {
      console.log('\n📋 Prodotti con barcode:', withBarcode.map(p => `${p.name} (${p.barcode})`));
    }
    
    if (withoutBarcode.length > 0) {
      console.log('\n📋 Prodotti senza barcode:', withoutBarcode.map(p => p.name));
    }
  }

  // Debug methods for testing barcode vs name image search
  async testBarcodeSearch(barcode: string): Promise<void> {
    await this.homeService.testBarcodeImageSearch(barcode);
  }
  
  async testNameSearch(productName: string): Promise<void> {
    await this.homeService.testNameImageSearch(productName);
  }
  
  // Test with common barcodes
  async runImageSearchTests(): Promise<void> {
    console.log('=== Testing Image Search System ===');
    
    // Test barcode search
    await this.testBarcodeSearch('8076800195057'); // Nutella
    await this.testBarcodeSearch('8000500037003'); // Coca Cola
    
    // Test name search
    await this.testNameSearch('Acqua naturale');
    await this.testNameSearch('Pane integrale');
    
    console.log('=== Test Complete ===');
  }

}
