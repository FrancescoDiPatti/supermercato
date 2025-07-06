import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonText, IonMenu,
  IonMenuButton, IonButtons, IonIcon, IonSplitPane, IonSearchbar, IonList,
  IonItem, IonBadge, MenuController
} from '@ionic/angular/standalone';
import { SearchService } from '../services/search/search.service';
import { HomeService, Supermarket, SearchResult, RecentSearch } from '../services/home/home.service';
import { AuthService } from '../auth/auth.service';
import { addIcons } from 'ionicons';
import {
  storefrontOutline, cubeOutline, cartOutline, receiptOutline, logOutOutline,
  menuOutline, pricetagsOutline, gridOutline, arrowBackOutline, timeOutline,
  searchOutline, close, addOutline, addCircleOutline,
} from 'ionicons/icons';
import { filter, map, take } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import { debounceTime, Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    RouterModule, IonContent, IonHeader, IonTitle, IonToolbar, IonButton, 
    IonMenu, IonMenuButton, IonButtons, IonIcon, IonSplitPane, IonSearchbar,
    IonList, IonItem, IonBadge, IonText
  ]
})
export class HomePage implements OnInit, OnDestroy {
  public homeData: any;
  public errorMsg = '';
  public searchTerm: string = '';
  public searchResults: SearchResult[] = [];
  public recentSearches: RecentSearch[] = [];
  public showRecentSearches: boolean = false;
  public isSearching: boolean = false;
  public showResults: boolean = false;
  public showOverlay: boolean = false;
  public isSearchActive: boolean = false;
  public currentPlaceholder: string = 'Ricerca...';
  public selectedSupermarket: any = null;
  public cartItemCount: number = 0;
  public readonly currentUser$ = this.homeService.currentUser$;

  private activeUrl = '';
  private searchSubject = new Subject<string>();  
  private subscription: Subscription = new Subscription();
  private readonly RECENT_SEARCHES_KEY = 'recentSearches';
  private readonly MAX_RECENT_SEARCHES = 5;
  private readonly SEARCH_CONFIG = {
    '/prodotti': { placeholder: 'Cerca prodotti', type: 'products' },
    '/offerte': { placeholder: 'Cerca offerte', type: 'offers' },
    '/dashboard': { placeholder: 'Cerca supermercati', type: 'supermarkets' }
  } as const;
  constructor(
    private readonly homeService: HomeService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly elementRef: ElementRef,
    private readonly menuController: MenuController,
    private readonly searchService: SearchService
  ) {
    this.initializeIcons();
    this.setupRouterListener();
  }  

  ngOnInit(): void {
    this.loadHomeData();
    this.setupSearch();
    this.loadRecentSearches();
    this.setupUserListener();
    this.setupCartListener();
    this.setupSupermarketListener();
    this.updateCartCount();
  }  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  // Initialize icons
  private initializeIcons(): void {
    addIcons({ 
      storefrontOutline, 
      cubeOutline, 
      cartOutline, 
      receiptOutline,
      logOutOutline,
      menuOutline,
      pricetagsOutline,
      gridOutline,
      arrowBackOutline,
      timeOutline,
      searchOutline,
      close,
      addOutline,
      addCircleOutline
    });
  }

  // Setup router event listener
  private setupRouterListener(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.activeUrl = event.urlAfterRedirects;
      this.updatePlaceholder();
    });
  }

  // Load home data
  private loadHomeData(): void {
    this.homeData = null;
    this.errorMsg = '';
    this.homeService.getHome().subscribe({
      next: (res) => {
        this.homeData = res.data;
        if (res.data.user) {
          this.authService.updateUserData(res.data.user);
        }
      },
      error: (err) => {
        this.errorMsg = 'Errore nel recupero dei dati';
      }
    });
  }

  // Setup supermarket listener
  private setupSupermarketListener(): void {
    this.subscription.add(
      this.homeService.supermarkets.selectedSupermarket$.subscribe((supermarket: Supermarket | null) => {
        this.selectedSupermarket = supermarket;
      })
    );
  }

  // Load recent searches from localStorage
  private loadRecentSearches(): void {
    this.homeService.currentUser$.pipe(take(1)).subscribe(currentUser => {
      if (!currentUser?.id) return;

      const key = this.getRecentSearchesKey(currentUser.id);
      const stored = localStorage.getItem(key);
      
      if (stored) {
        try {
          this.recentSearches = JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing recent searches:', error);
          this.recentSearches = [];
        }
      }
    });
  }

  // Get supermarket image
  getSupermarketImage(name: string): string {
    return this.homeService.supermarkets.getStoreImage(name);
  }

  // Clear selected supermarket
  clearSelectedSupermarket(): void {
    this.homeService.supermarkets.clearSelectedSupermarket();
  }

  // Setup search
  private setupSearch(): void {
    this.subscription.add(
      this.searchSubject.pipe(
        debounceTime(300)
      ).subscribe(query => {
        this.performSearch(query);
      })
    );
  }
  
  // Setup user authentication listener
  private setupUserListener(): void {    
    this.subscription.add(
      this.authService.authState.subscribe(authState => {
        if (authState.isAuthenticated && authState.user) {
          this.handleUserLogin();
        } else {
          this.handleUserLogout();
        }
      })
    );
  }

  // Setup cart items listener
  private setupCartListener(): void {    
    this.subscription.add(
      this.homeService.cart.cartItems$.subscribe((items: any) => {
        this.cartItemCount = items.length;
      })
    );
  }

  // Handle user login
  private handleUserLogin(): void {
    this.resetSearch();
    this.recentSearches = [];
    this.loadRecentSearches();
    this.menuController.close();
  }

  // Handle user logout
  private handleUserLogout(): void {
    this.homeService.cart.clearCart();
    this.homeService.supermarkets.clearSelectedSupermarket();
    this.resetSearch();
    this.recentSearches = [];
    this.menuController.close();
  }

  // Set search placeholder
  private updatePlaceholder(): void {
    const config = Object.entries(this.SEARCH_CONFIG).find(([path]) => 
      this.activeUrl.includes(path)
    );
    this.currentPlaceholder = config ? config[1].placeholder : '';
  }

  // Handle search input change
  onInput(event: any): void {
    if (!this.isSearchFunctionalityAvailable()) {
      return;
    }
    
    const query = event.target.value;
    this.searchTerm = query;
    
    if (query.length >= 2) {
      this.handleActiveSearch();
    } else if (query.length === 0) {
      this.handleEmptySearch();
    } else {
      this.handlePartialSearch();
    }
  }

  // Handle active search (query >= 2 characters)
  private handleActiveSearch(): void {
    this.showRecentSearches = false;
    this.showOverlay = true;
    this.searchSubject.next(this.searchTerm);
  }

  // Handle empty search
  private handleEmptySearch(): void {
    this.showRecentSearches = true;
    this.showOverlay = true;
    this.searchResults = this.combineResults([], true);
    this.showResults = this.searchResults.length > 0;
  }

  // Handle partial search (1 character)
  private handlePartialSearch(): void {
    this.showOverlay = true;
    this.searchResults = [];
    this.showResults = false;
    this.showRecentSearches = false;
  }
  // Reset search state
  private resetSearch(): void {
    this.searchResults = [];
    this.showResults = false;
    this.showRecentSearches = false;
    this.showOverlay = false;
    this.isSearchActive = false;
    this.isSearching = false;
  }

  // Perform search with query
  private async performSearch(query: string): Promise<void> {
    if (!query?.trim()) {
      this.resetSearch();
      return;
    }    
    this.isSearching = true;
    this.showRecentSearches = false;
    this.showOverlay = true;
    const rawResults = await this.executeSearch(query);
    const showRecent = rawResults.length < 3;
    this.searchResults = this.combineResults(rawResults, showRecent);
    this.showResults = this.searchResults.length > 0;
    this.isSearching = false;
  }
  // Execute search by type
  private async executeSearch(query: string): Promise<SearchResult[]> {
    const currentType = this.getSearchType();
    
    switch (currentType) {
      case 'products':
        return this.searchProducts(query);
      case 'offers':
        return this.searchOffers(query);
      case 'supermarkets':
        return this.searchSupermarkets(query);
      default:
        return [];
    }
  }
  // Search supermarkets
  private async searchSupermarkets(query: string): Promise<SearchResult[]> {
    try {
      const supermarkets = await this.homeService.supermarkets.getSupermarketsForCurrentUser();
      if (supermarkets.length === 0) {
        return [];
      }
      let userPosition: { lat: number; lng: number } | null = null;
      try {
        userPosition = await this.homeService.position.getCurrentPosition();
      } catch (e) {}
      const searchResults = this.searchService.search(query, supermarkets, userPosition || undefined);
      return searchResults.map((result: SearchResult) => ({
        ...result,
        icon: 'storefront-outline'
      }));
    } catch (error) {
      console.error('Error searching supermarkets:', error);
      return [];
    }
  }

  // Search products in current supermarket
  private async searchProducts(query: string): Promise<SearchResult[]> {
    if (!this.selectedSupermarket) {
      return [];
    }

    try {
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.homeService.ui.createDataState(), 
        true,
        true
      );
      
      const allProducts = [...result.products, ...result.offerProducts];
      
      if (allProducts.length === 0) {
        return [];
      }

      const searchResults = this.filterProductsByQuery(allProducts, query);
      return this.mapProductsToSearchResults(searchResults, false);
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  // Search offers in current supermarket
  private async searchOffers(query: string): Promise<SearchResult[]> {
    if (!this.selectedSupermarket) {
      return [];
    }

    try {
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.homeService.ui.createDataState(), 
        false,
        true
      );
      
      const offers = result.offerProducts;
      
      if (offers.length === 0) {
        return [];
      }

      const searchResults = this.filterProductsByQuery(offers, query);
      return this.mapProductsToSearchResults(searchResults, true);
    } catch (error) {
      console.error('Error searching offers:', error);
      return [];
    }
  }

  // Filter products by search query
  private filterProductsByQuery(products: any[], query: string): any[] {
    const lowerQuery = query.toLowerCase();
    
    return products.filter(product => {
      const nameMatch = product.name?.toLowerCase().includes(lowerQuery);
      const descriptionMatch = product.description?.toLowerCase().includes(lowerQuery);
      const categoryMatch = product.category?.toLowerCase().includes(lowerQuery);
      const barcodeMatch = product.barcode?.includes(query);
      
      return nameMatch || descriptionMatch || categoryMatch || barcodeMatch;
    }).slice(0, 8);
  }

  // Map products to search results
  private mapProductsToSearchResults(products: any[], isOffer: boolean = false): SearchResult[] {
    return products.map((product: any) => ({
      id: product.barcode || product.id.toString(),
      label: product.name,
      sublabel: isOffer 
        ? `Offerta: €${(product.offer_price || product.price || 0).toFixed(2)}`
        : product.description || `€${(product.offer_price || product.price || 0).toFixed(2)}`,
      type: 'search' as const,
      icon: isOffer ? 'pricetag-outline' : 'cube-outline',
      data: product
    }));
  }

  // Handle search result selection
  selectResult(result: SearchResult): void {
    this.searchTerm = result.label;
    this.isSearching = false;
    this.resetSearch();

    if (result.type === 'recent') {
      this.handleRecent(result);
    } else {
      this.saveRecent(result.label, this.getSearchType(), result);
      this.navigate(result);
    }
  }

  // Handle recent search selection
  private handleRecent(result: SearchResult): void {
    const recentSearch = this.recentSearches.find(search => 
      search.query === result.label && search.type === this.getSearchType()
    );
    
    if (recentSearch?.data) {
      const storedResult: SearchResult = {
        id: recentSearch.resultId || recentSearch.data.id || result.id,
        label: result.label,
        data: recentSearch.data,
        type: 'search',
        icon: result.icon
      };
      this.navigate(storedResult);
    } else {
      this.searchSubject.next(result.label);
    }
  }

  // Navigate to selected result
  private navigate(result: SearchResult): void {
    const currentType = this.getSearchType();
    
    switch (currentType) {
      case 'supermarkets':
        this.handleSupermarketNavigation(result);
        break;
      case 'products':
        this.dispatchProductEvent('productSelectedFromSearch', result.data);
        break;
      case 'offers':
        this.dispatchProductEvent('offerSelectedFromSearch', result.data);
        break;
    }
  }

  // Handle supermarket navigation
  private handleSupermarketNavigation(result: SearchResult): void {
    if (!result.data) return;
    
    if (!this.activeUrl.includes('/dashboard')) {
      this.router.navigate(['/home/dashboard']).then(() => {
        setTimeout(() => {
          this.selectSupermarketFromSearch(result.data);
        }, 100);
      });
    } else {
      this.selectSupermarketFromSearch(result.data);
    }
  }

  // Dispatch product/offer selection event
  private dispatchProductEvent(eventName: string, productData: any): void {
    if (productData) {
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: { product: productData }
      }));
    }
  }

  // Select and center supermarket from search
  private selectSupermarketFromSearch(supermarket: any): void {
    this.homeService.supermarkets.setSelectedSupermarket(supermarket);
    window.dispatchEvent(new CustomEvent('supermarketSelectedFromSearch', {
      detail: { supermarket }
    }));
  }

  // Handle search input focus
  onFocus(): void {
    if (!this.isSearchFunctionalityAvailable()) {
      return;
    }
    
    this.activateSearch();
    this.showRecentSearchesIfEmpty();
  }
  
  // Handle search input blur
  onBlur(): void {
    setTimeout(() => this.resetSearch(), 200);
  }

  // Clear search input
  clearSearch(): void {
    this.searchTerm = '';
    this.isSearching = false;
    this.resetSearch();
    
    if (this.isSearchActive && this.isSearchFunctionalityAvailable()) {
      this.showRecentSearchesIfEmpty();
    }
  }

  // Handle search cancellation
  onCancel(): void {
    if (!this.isSearchFunctionalityAvailable()) {
      return;
    }
    
    this.isSearching = false;
    this.clearSearch();
    this.blurActiveElement();
  }

  // Handle enter key in search
  onEnter(event: any): void {
    if (!this.isSearchFunctionalityAvailable()) {
      return;
    }
    
    event.preventDefault();
    if (this.searchResults?.length > 0) {
      this.selectResult(this.searchResults[0]);
    }
  }

  // Check if search functionality is available
  private isSearchFunctionalityAvailable(): boolean {
    return !!this.currentPlaceholder;
  }

  // Activate search mode
  private activateSearch(): void {
    this.showOverlay = true;
    this.isSearchActive = true;
    
    if (this.searchTerm?.length > 0) {
      this.searchTerm = '';
      this.searchResults = [];
    }
  }

  // Show recent searches if search is empty
  private showRecentSearchesIfEmpty(): void {
    this.showRecentSearches = true;
    this.searchResults = this.combineResults([], true);
    this.showResults = this.searchResults.length > 0;
  }

  // Remove focus from active element
  private blurActiveElement(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }

  // Save recent search to localStorage
  private saveRecent(query: string, type: string, result?: SearchResult): void {
    this.homeService.currentUser$.pipe(take(1)).subscribe(currentUser => {
      if (!currentUser?.id) return;

      const key = this.getRecentSearchesKey(currentUser.id);
      const newSearch = this.createRecentSearch(query, type, currentUser.id, result);
      
      this.updateRecentSearches(newSearch);
      this.persistRecentSearches(key);
    });
  }

  // Get recent searches storage key
  private getRecentSearchesKey(userId: number): string {
    return `${this.RECENT_SEARCHES_KEY}_${userId}`;
  }

  // Create new recent search object
  private createRecentSearch(query: string, type: string, userId: number, result?: SearchResult): RecentSearch {
    return {
      query,
      timestamp: Date.now(),
      type,
      userId,
      data: result?.data,
      resultId: result?.id
    };
  }

  // Update recent searches array
  private updateRecentSearches(newSearch: RecentSearch): void {
    this.recentSearches = this.recentSearches.filter(search => 
      search.query.toLowerCase() !== newSearch.query.toLowerCase() || search.type !== newSearch.type
    );
    this.recentSearches.unshift(newSearch);
    this.recentSearches = this.recentSearches.slice(0, this.MAX_RECENT_SEARCHES);
  }

  // Persist recent searches to localStorage
  private persistRecentSearches(key: string): void {
    localStorage.setItem(key, JSON.stringify(this.recentSearches));
  }  
  
  // Combine search results with recent searches
  private combineResults(searchResults: SearchResult[], showRecent: boolean = false): SearchResult[] {
    const combinedResults: SearchResult[] = [];
    const actualResults = searchResults.map(result => ({
      ...result,
      type: 'search' as const,
      icon: 'search-outline'
    }));
    let recentForType: SearchResult[] = [];
    if (showRecent && this.recentSearches.length > 0) {
      const currentType = this.getSearchType();
      recentForType = this.recentSearches
        .filter(recent => recent.type === currentType)
        .slice(0, 3)
        .map(recent => ({
          id: `recent_${recent.timestamp}`,
          label: recent.query,
          sublabel: 'Ricerca recente',
          type: 'recent' as const,
          icon: 'time-outline'
        }));
    }
    if (actualResults.length > 0 && actualResults.length < 3) {
      combinedResults.push(...actualResults);
      combinedResults.push(...recentForType);
    } else {
      combinedResults.push(...recentForType);
      combinedResults.push(...actualResults);
    }
    return combinedResults;
  }

  // Get current search type
  private getSearchType(): string {
    const config = Object.entries(this.SEARCH_CONFIG).find(([path]) => 
      this.activeUrl.includes(path)
    );
    return config ? config[1].type : 'general';
  }


  // Check if supermarket visibility
  shouldShowSupermarketSelection(): boolean {
    return this.activeUrl.includes('/prodotti')
      || this.activeUrl.includes('/offerte')
      || this.activeUrl.includes('/carrello')
      || this.activeUrl.includes('/gestione/aggiungi-prodotto')
      || this.activeUrl.includes('/gestione/crea-prodotto');
  }

  // Check if menu item is active
  isMenuActive(path: string): boolean {
    return this.activeUrl === `/home/${path}` || (path === 'dashboard' && (this.activeUrl === '/home' || this.activeUrl === '/home/dashboard'));
  }

  // Check cart visibility
  get shouldShowCartIcon$() {
    return this.homeService.currentUser$.pipe(
      map((user) => user?.role === 'customer' && !this.activeUrl.includes('/carrello') && !this.activeUrl.includes('/ordini'))
    );
  }

  // Handle user logout
  logout(): void {
    this.clearSearch();
    sessionStorage.removeItem('inventoryData');
    sessionStorage.removeItem('cartItems');
    this.recentSearches = [];
    this.homeService.cart.clearCart();
    this.homeService.supermarkets.clearSelectedSupermarket();
    this.menuController.close();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  // Navigate and close menu
  navAndClose(route: string): void {
    this.router.navigate([`/home/${route}`]);
    if (window.innerWidth < 992) {
      this.menuController.close();
    }
  }

  // Navigate to cart
  goToCart(): void {
    this.router.navigate(['/home/carrello']);
  }

  // Update cart item count
  private updateCartCount(): void {
    this.cartItemCount = this.homeService.cart.getCartItemsCount();
  }
}
