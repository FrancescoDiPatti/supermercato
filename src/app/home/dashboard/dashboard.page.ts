import { Component, OnInit, HostListener, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonIcon, IonGrid, IonRow, IonCol,
  IonList, IonItem, IonLabel, IonSpinner, IonText,
  IonImg, IonBadge, IonFabButton
} from '@ionic/angular/standalone';
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
  standalone: true,
  imports: [
    IonContent, IonIcon, IonGrid, IonRow, IonCol,
    IonList, IonItem, IonLabel, IonSpinner, IonText,
    IonImg, IonBadge, IonFabButton,
    CommonModule, FormsModule
  ]
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
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
  
  // Animation state - now managed by service
  private animationState = this.homeService.createAnimationState();
  
  isLargeScreen = false;
  canCreateSupermarket = false;
  showCreateCard = false;
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

  // User role getters
  get isUserCustomer() { 
    const user = this.authService.getUser();
    return HomeService.isCustomer(user);
  }
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
  }  
  async ngOnInit() {
    this.checkScreenSize();
    this.checkUserRole();
    this.subscribeToSupermarketChanges();
      await Promise.all([
      this.initializeUserLocation(),
      ...(this.isUserCustomer ? [this.loadPurchaseHistory()] : [])
    ]);
      await this.loadSupermarkets();
    // Auto-expand map if no supermarket is selected
    this.autoExpandMapIfNeeded();
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

  // initialization
  private subscribeToSupermarketChanges() {
    this.homeService.selectedSupermarket$.subscribe(supermarket => {
      this.handleSupermarketSelection(supermarket);
    });
  }

  private async initializeUserLocation(): Promise<void> {
    try {
      const position = await this.homeService.getCurrentPosition();
      if (position) {
        this.userPosition = position;
        this.updateMapWithUserLocation();
      }
    } catch (error) {
      console.warn('Error getting location:', error);
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
      // Clean up map resources
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

    try {
      await Promise.all([
        this.loadProducts(),
        this.loadOffers()
      ]);
      this.generateCategories();
      this.startProductAnimations();
    } catch (error) {
      console.error('Error loading supermarket data:', error);
    } finally {
      this.isLoading = false;
    }
  }  // clear supermarket
  private clearSupermarketData() {
    this.homeService.clearSupermarketData(this.dataState);
    this.resetAnimations();
  }  // load products
  private async loadProducts() {
    if (!this.selectedSupermarket) return;
    const products = await this.homeService.loadSupermarketProducts(this.selectedSupermarket.id);
    this.homeService.updateProducts(this.dataState, products);
  }  // load offers
  private async loadOffers() {
    if (!this.selectedSupermarket) return;
    const offerProducts = await this.homeService.loadSupermarketOffers(this.selectedSupermarket.id);
    this.homeService.updateOfferProducts(this.dataState, offerProducts);
  }  // load categories
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
  }// Navigation methods
  onCreateSupermarket() {
    this.router.navigate(['/crea/crea-supermercato']);
  }  // Product and category methods
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

}
