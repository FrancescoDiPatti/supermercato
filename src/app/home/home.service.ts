import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Import the dedicated services
import { SupermercatiService, Supermarket, User } from '../services/supermercati/supermercati.service';
import { ProdottiService } from '../services/prodotti/prodotti.service';
import { PosizioneService } from '../services/posizione/posizione.service';
import { SearchService, SearchResult, RecentSearch } from '../services/search/search.service';
import { UiService, AnimationState, SupermarketDataState } from '../services/ui/ui.service';
import { MapService, LeafletEvent } from '../services/map/map.service';
import { UserService } from '../services/user/user.service';
import { CarrelloService, CartItem } from '../services/carrello/carrello.service';

// Re-export interfaces for backward compatibility
export { Supermarket, User, SearchResult, RecentSearch, LeafletEvent, CartItem, AnimationState, SupermarketDataState };

@Injectable({
  providedIn: 'root'
})
export class HomeService {  constructor(
    private http: HttpClient,
    private supermercatiService: SupermercatiService,
    private prodottiService: ProdottiService,
    private posizioneService: PosizioneService,
    private searchService: SearchService,
    private uiService: UiService,
    private mapService: MapService,
    private userService: UserService,
    private carrelloService: CarrelloService
  ) { }

  getHome(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/dashboard`, { withCredentials: true });
  }

  // Delegate to SupermercatiService
  getSupermarkets() { return this.supermercatiService.getSupermarkets(); }
  getSupermarketDetails(id: number) { return this.supermercatiService.getSupermarketDetails(id); }
  setSelectedSupermarket(supermarket: Supermarket) { return this.supermercatiService.setSelectedSupermarket(supermarket); }
  getSelectedSupermarket() { return this.supermercatiService.getSelectedSupermarket(); }
  clearSelectedSupermarket() { return this.supermercatiService.clearSelectedSupermarket(); }
  get selectedSupermarket$() { return this.supermercatiService.selectedSupermarket$; }
  addSupermarket(supermarket: any) { return this.supermercatiService.addSupermarket(supermarket); }  getManagers() { return this.supermercatiService.getManagers(); }
  getStoreImage(name: string) { return this.supermercatiService.getStoreImage(name); }
  getSupermarketsForCurrentUser() { return this.supermercatiService.getSupermarketsForCurrentUser(); }
  loadAndSetupSupermarkets(isManager?: boolean, managerId?: string, userPosition?: { lat: number; lng: number }) { 
    return this.supermercatiService.loadAndSetupSupermarkets(isManager, managerId, userPosition); 
  }

  // Delegate to ProdottiService
  getProductImage(productName: string, barcode?: string) { return this.prodottiService.getProductImage(productName, barcode); }
  getCategoryIcon(category: string) { return this.prodottiService.getCategoryIcon(category); }
  generateCategories(products: any[]) { return this.prodottiService.generateCategories(products); }
  getDisplayPrice(product: any) { return this.prodottiService.getDisplayPrice(product); }
  getOriginalPrice(product: any) { return this.prodottiService.getOriginalPrice(product); }
  filterProductsByCategory(products: any[], categoryName: string) { return this.prodottiService.filterProductsByCategory(products, categoryName); }
  loadSupermarketProducts(supermarketId: number) { return this.prodottiService.loadSupermarketProducts(supermarketId); }
  loadSupermarketOffers(supermarketId: number) { return this.prodottiService.loadSupermarketOffers(supermarketId); }
  loadPurchaseHistory(limit?: number) { return this.prodottiService.loadPurchaseHistory(limit); }

  // Delegate to PosizioneService
  calcDistance(lat1: number, lon1: number, lat2: number, lon2: number) { return this.posizioneService.calcDistance(lat1, lon1, lat2, lon2); }
  deg2rad(deg: number) { return this.posizioneService.deg2rad(deg); }
  formatDistance(distance: number) { return this.posizioneService.formatDistance(distance); }
  getDistanceFromUser(userPosition: { lat: number; lng: number } | null, latitude: number, longitude: number) { 
    return this.posizioneService.getDistanceFromUser(userPosition, latitude, longitude); 
  }
  getCurrentPosition() { return this.posizioneService.getCurrentPosition(); }
  formatAddress(suggestion: any, inputAddress: string) { return this.posizioneService.formatAddress(suggestion, inputAddress); }
  fetchAddressSuggestions(address: string) { return this.posizioneService.fetchAddressSuggestions(address); }  
  // Delegate to UiService
  checkScreenSize() { return this.uiService.checkScreenSize(); }
  setupHorizontalScroll(containerSelector: string) { return this.uiService.setupHorizontalScroll(containerSelector); }
  removeScrollListeners(scrollListeners: Array<{ element: Element; listener: EventListener }>) { 
    return this.uiService.removeScrollListeners(scrollListeners); 
  }
  getActiveContainer(viewChildRef?: { nativeElement: HTMLElement }) {
    return this.uiService.getActiveContainer(viewChildRef);
  }
  scrollToSelectedCard(container: HTMLElement, selectedCard: HTMLElement) {
    return this.uiService.scrollToSelectedCard(container, selectedCard);
  }
  centerSelectedItem<T extends { id: number }>(items: T[], selectedItem: T, viewChildRef?: { nativeElement: HTMLElement }, cardSelector?: string) {
    return this.uiService.centerSelectedItem(items, selectedItem, viewChildRef, cardSelector);
  }
  openModal(modalElement: any, resetCallback?: () => void) { return this.uiService.openModal(modalElement, resetCallback); }
  closeModal(modalElement: any, clearCallback?: () => void) { return this.uiService.closeModal(modalElement, clearCallback); }
  executeWithLoading<T>(loadingStateCallback: (loading: boolean) => void, asyncOperation: () => Promise<T>) { 
    return this.uiService.executeWithLoading(loadingStateCallback, asyncOperation); 
  }

  // Delegate to MapService
  initializeMap(containerIdOrElement: string | any, options?: any) { return this.mapService.initializeMap(containerIdOrElement, options); }
  completeMapSetup(map: any, userPosition?: { lat: number; lng: number }, supermarkets?: Supermarket[], onMarkerClick?: (supermarket: Supermarket) => void, userMarkerCallback?: (marker: any) => void, markersCallback?: (markers: any[]) => void) { 
    return this.mapService.completeMapSetup(map, userPosition, supermarkets, onMarkerClick, userMarkerCallback, markersCallback); 
  }
  createMapInstance(containerId: string, options?: any) { return this.mapService.createMapInstance(containerId, options); }
  addGoogleTileLayer(map: any) { return this.mapService.addGoogleTileLayer(map); }
  createUserMarker(map: any, position: { lat: number; lng: number }, options?: any) { return this.mapService.createUserMarker(map, position, options); }
  updateUserMarkerPosition(userMarker: any, map: any, position: { lat: number; lng: number }, zoom?: number) { 
    return this.mapService.updateUserMarkerPosition(userMarker, map, position, zoom); 
  }
  centerOnUserPosition(map: any, position: { lat: number; lng: number }, zoom?: number) {
    return this.mapService.centerOnUserPosition(map, position, zoom);
  }
  createSupermarketMarkers(map: any, supermarkets: Supermarket[], onMarkerClick?: (supermarket: Supermarket) => void) { 
    return this.mapService.createSupermarketMarkers(map, supermarkets, onMarkerClick); 
  }
  clearMarkers(markers: any[]) { return this.mapService.clearMarkers(markers); }
  selectSupermarketOnMap(supermarket: Supermarket, map: any, markers: any[], fromMarkerClick?: boolean, zoom?: number, animationDuration?: number) { 
    return this.mapService.selectSupermarketOnMap(supermarket, map, markers, fromMarkerClick, zoom, animationDuration); 
  }

  // Delegate to UserService
  static isAdmin(user: any) { return UserService.isAdmin(user); }
  static isManager(user: any) { return UserService.isManager(user); }
  static isCustomer(user: any) { return UserService.isCustomer(user); }
  static isAdminOrManager(user: any) { return UserService.isAdminOrManager(user); }  getCurrentUser() { return this.userService.getCurrentUser(); }
  isUserAdmin() { return this.userService.isUserAdmin(); }
  isUserManager() { return this.userService.isUserManager(); }
  isUserAdminOrManager() { return this.userService.isUserAdminOrManager(); }
  canCreateSupermarket() { return this.userService.canCreateSupermarket(); }
  // Delegate to CarrelloService
  addToCart(product: any, supermarket: any) { return this.carrelloService.addToCart(product, supermarket); }
  removeFromCart(productId: number, supermarketId: number) { return this.carrelloService.removeFromCart(productId, supermarketId); }
  updateCartQuantity(productId: number, supermarketId: number, quantity: number) { 
    return this.carrelloService.updateQuantity(productId, supermarketId, quantity); 
  }
  getCartItems() { return this.carrelloService.getCartItems(); }
  getCartTotal() { return this.carrelloService.getCartTotal(); }
  getCartItemsCount() { return this.carrelloService.getCartItemsCount(); }
  clearCart() { return this.carrelloService.clearCart(); }
  get cartItems$() { return this.carrelloService.cartItems$; }

  // === SORT UTILITIES (kept in HomeService) ===
  sortByDistance(supermarkets: Supermarket[], userLat: number, userLng: number): Supermarket[] {
    return supermarkets.sort((a, b) => {
      const distA = this.calcDistance(userLat, userLng, a.latitude, a.longitude);
      const distB = this.calcDistance(userLat, userLng, b.latitude, b.longitude);
      return distA - distB;
    });
  }  // Direct delegation to UiService (SupermarketDataService functionality)
  createDataState(): SupermarketDataState {
    return this.uiService.createDataState();
  }
  clearSupermarketData(state: SupermarketDataState): void {
    this.uiService.clearSupermarketData(state);
  }
  updateProducts(state: SupermarketDataState, products: any[]): void {
    this.uiService.updateProducts(state, products);
  }
  updateOfferProducts(state: SupermarketDataState, offerProducts: any[]): void {
    this.uiService.updateOfferProducts(state, offerProducts);
  }
  updateCategories(state: SupermarketDataState, categories: any[]): void {
    this.uiService.updateCategories(state, categories);
  }
  updateFilteredProducts(state: SupermarketDataState, filteredProducts: any[]): void {
    this.uiService.updateFilteredProducts(state, filteredProducts);
  }
  updatePurchaseHistory(state: SupermarketDataState, purchaseHistory: any[]): void {
    this.uiService.updatePurchaseHistory(state, purchaseHistory);
  }
  setSelectedCategory(state: SupermarketDataState, categoryName: string): void {
    this.uiService.setSelectedCategory(state, categoryName);
  }

  // Direct delegation to UiService (AnimationService functionality)
  resetAnimations(state: AnimationState): void {
    this.uiService.resetAnimations(state);
  }
  startOffersAnimation(offerProducts: any[], state: AnimationState): void {
    this.uiService.startOffersAnimation(offerProducts, state);
  }
  startProductsAnimation(filteredProducts: any[], offerProducts: any[], state: AnimationState): void {
    this.uiService.startProductsAnimation(filteredProducts, offerProducts, state);
  }
  startAllProductAnimations(filteredProducts: any[], offerProducts: any[], state: AnimationState): void {
    this.uiService.startAllProductAnimations(filteredProducts, offerProducts, state);
  }
  startCategoryAnimation(filteredProducts: any[], state: AnimationState): void {
    this.uiService.startCategoryAnimation(filteredProducts, state);
  }
  isProductAnimated(productId: number, state: AnimationState): boolean {
    return this.uiService.isProductAnimated(productId, state);
  }
  isOfferAnimated(productId: number, state: AnimationState): boolean {
    return this.uiService.isOfferAnimated(productId, state);
  }
  createAnimationState(): AnimationState {
    return this.uiService.createAnimationState();
  }
}
