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
import { HomeService, Product, Category, PurchaseHistory } from '../home.service';
import { Supermarket } from '../../services/supermercati/supermercati.service';
import { SupermarketDataState, AnimationState } from '../../services/ui/ui.service';
import { AuthService } from '../../auth/auth.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonIcon, IonGrid, IonRow, IonCol,
    IonList, IonItem, IonLabel, IonSpinner, IonText,
    IonImg, IonBadge, IonFabButton, IonButton,
    CommonModule, FormsModule
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
  private searchListener: EventListener | null = null;

  // Getters
  get products() { return this.dataState.products; }
  get offerProducts() { return this.dataState.offerProducts; }
  get categories() { return this.dataState.categories; }
  get selectedCategory() { return this.dataState.selectedCategory; }
  get filteredProducts() { return this.dataState.filteredProducts; }
  get purchaseHistory() { return this.dataState.purchaseHistory; }
  get displayProducts() { return this.filteredProducts.slice(0, 8); }
  get displayOfferProducts() { return this.offerProducts.slice(0, 8); }
  get canCreateContent() { return this.homeService.isUserAdmin() || this.homeService.isUserManager(); }
  
  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ add, storefront, location, checkmarkCircle, chevronForwardOutline, map, chevronUp, chevronDown });
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
    this.setupHorizontalScroll();
    if (this.isMapExpanded && !this.map) {
      requestAnimationFrame(() => this.initMap());
    }
  }

  ngOnDestroy() {
    this.cleanup();
  }

  ionViewWillEnter() {
    if (this.selectedSupermarket && this.supermarkets.length > 0) {
      requestAnimationFrame(() => this.centerSelectedSupermarket(this.selectedSupermarket!));
    }
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
  
  private setupSearchListener() {
    this.searchListener = ((event: CustomEvent) => {
      if (event.detail?.supermarket) {
        this.selectedSupermarket = event.detail.supermarket;
        requestAnimationFrame(() => this.selectSupermarket(event.detail.supermarket));
      }
    }) as EventListener;
    window.addEventListener('listenSMSelectionSearch', this.searchListener);
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
      requestAnimationFrame(() => this.setupHorizontalScroll());
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
    this.homeService.setSelectedSupermarket(supermarket);
    this.homeService.selectSupermarketOnMap(supermarket, this.map, this.markers, false, 14);
    if (this.isMapExpanded && !this.userExpandedMap) {
      this.isMapExpanded = false;
    }
    this.centerSelectedSupermarket(supermarket);
    requestAnimationFrame(() => this.setupHorizontalScroll());
  }

  private centerSelectedSupermarket(selectedSupermarket: Supermarket) {
    this.homeService.centerSelectedItem(
      this.supermarkets,
      selectedSupermarket, 
      this.supermarketsContainer
    );
  }

  async onSupermarketChange() {
    if (!this.selectedSupermarket) {
      this.homeService.clearSupermarketData(this.dataState);
      this.resetAnimations();
      return;
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
        return { products, offerProducts };
      }
    );
  }
  
  private async loadSupermarketData(): Promise<{ products: any[], offerProducts: any[] }> {
    if (!this.selectedSupermarket) return { products: [], offerProducts: [] };
    const result = await this.homeService.loadSupermarketDataWithoutImages(this.selectedSupermarket.id, this.dataState, true, true);
    return { products: result.products, offerProducts: result.offerProducts };
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
    const categories = this.homeService.generateCategories(this.products);
    this.homeService.updateCategories(this.dataState, categories);
  }

  onCategorySelect(categoryName: string) {
    this.homeService.setSelectedCategory(this.dataState, categoryName);
    const filteredProducts = this.homeService.filterProductsByCategory(this.products, categoryName);
    this.homeService.updateFilteredProducts(this.dataState, filteredProducts);
    this.homeService.startCategoryAnimation(this.displayProducts, this.animationState);
  }

  addToCart(product: Product) {
    if (this.selectedSupermarket) {
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
    if (this.searchListener) {
      window.removeEventListener('listenSMSelectionSearch', this.searchListener);
      this.searchListener = null;
    }
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
}
