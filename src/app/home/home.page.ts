import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonText,
  IonMenu,
  IonMenuButton,
  IonButtons,
  IonIcon,
  IonSplitPane,
  IonSearchbar,
  IonList,
  IonItem,
  IonBadge,
  MenuController
} from '@ionic/angular/standalone';
import { SearchService } from '../services/search/search.service';
import { HomeService, Supermarket, SearchResult, RecentSearch } from '../services/home/home.service';
import { AuthService } from '../auth/auth.service';
import { addIcons } from 'ionicons';
import {
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
  addCircleOutline,
} from 'ionicons/icons';
import { filter } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import { debounceTime, Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonText,
    IonMenu,
    IonMenuButton,
    IonButtons,
    IonIcon,
    IonSplitPane,
    IonSearchbar,
    IonList,
    IonItem,
    IonBadge
  ]
})
export class HomePage implements OnInit, OnDestroy {
  homeData: any;
  errorMsg = '';
  private activeUrl = '';
  searchTerm: string = '';
  searchResults: SearchResult[] = [];
  recentSearches: RecentSearch[] = [];
  showRecentSearches: boolean = false;
  isSearching: boolean = false;
  showResults: boolean = false;
  showOverlay: boolean = false;
  isSearchActive: boolean = false;
  currentPlaceholder: string = 'Ricerca...';
  selectedSupermarket: any = null;
  
  // Cart functionality
  cartItemCount: number = 0;
  
  private searchSubject = new Subject<string>();  
  private subscription: Subscription = new Subscription();
  private readonly RECENT_SEARCHES_KEY = 'recentSearches';
  private readonly MAX_RECENT_SEARCHES = 5;  private readonly SEARCH_CONFIG = {
    '/prodotti': { placeholder: 'Cerca prodotti', type: 'products' },
    '/offerte': { placeholder: 'Cerca offerte', type: 'offers' },
    '/dashboard': { placeholder: 'Cerca supermercati', type: 'supermarkets' }
  } as const;
  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef,
    private menuController: MenuController,
    private searchService: SearchService
  ) {    addIcons({ 
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
      this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.activeUrl = event.urlAfterRedirects;
      this.updatePlaceholder();
    });
  }  

  ngOnInit() {
    this.loadHome();
    this.setupSearch();
    this.loadRecent();
    this.setupUserListener();
    this.setupCartListener();
    
    // Subscribe to selected supermarket changes
    this.subscription.add(
      this.homeService.supermarkets.selectedSupermarket$.subscribe((supermarket: Supermarket | null) => {
        this.selectedSupermarket = supermarket;
      })
    );
    
    // Initialize cart count
    this.updateCartCount();
  }  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  getSupermarketImage(name: string): string {
    return this.homeService.supermarkets.getStoreImage(name);
  }

  clearSelectedSupermarket(): void {
    this.homeService.supermarkets.clearSelectedSupermarket();
  }

  // Debounce search
  private setupSearch() {
    this.subscription.add(
      this.searchSubject.pipe(
        debounceTime(300)
      ).subscribe(query => {
        this.search(query);
      })
    );
  }  private setupUserListener() {    
    this.subscription.add(
      this.authService.authState.subscribe(authState => {
        if (authState.isAuthenticated && authState.user) {
          // User logged in
          this.resetSearch();
          this.recentSearches = [];
          this.loadRecent();
          this.menuController.close();
        } else {
          this.homeService.supermarkets.clearSelectedSupermarket();
          this.resetSearch();
          this.recentSearches = [];
          this.menuController.close();
        }
      })
    );
  }  private setupCartListener() {    
    this.subscription.add(
      this.homeService.cart.cartItems$.subscribe((items: any) => {
        this.cartItemCount = items.length;
      })
    );
  }

  // Set placehoalder
  private updatePlaceholder() {
    const config = Object.entries(this.SEARCH_CONFIG).find(([path]) => 
      this.activeUrl.includes(path)
    );
    this.currentPlaceholder = config ? config[1].placeholder : '';
  }  
  
  // Manage search input
  onInput(event: any) {
    // Don't process search if no search functionality is available
    if (!this.currentPlaceholder) {
      return;
    }
    
    const query = event.target.value;
    this.searchTerm = query;
    
    if (query.length >= 2) {
      this.showRecentSearches = false;
      this.showOverlay = true;
      this.searchSubject.next(query);
    } else if (query.length === 0) {
      this.showRecentSearches = true;
      this.showOverlay = true;
      this.searchResults = this.combineResults([], true);
      this.showResults = this.searchResults.length > 0;
    } else {
      this.showOverlay = true;
      this.searchResults = [];
      this.showResults = false;
      this.showRecentSearches = false;
    }
  }
  // Reset search
  private resetSearch() {
    this.searchResults = [];
    this.showResults = false;
    this.showRecentSearches = false;
    this.showOverlay = false;
    this.isSearchActive = false;
    this.isSearching = false;
  }  private async search(query: string) {
    if (!query?.trim()) {
      this.resetSearch();
      return;
    }    
    this.isSearching = true;
    this.showRecentSearches = false;
    this.showOverlay = true;
    const rawResults = await this.execSearch(query);
    const showRecent = rawResults.length < 3;
    this.searchResults = this.combineResults(rawResults, showRecent);
    this.showResults = this.searchResults.length > 0;
    this.isSearching = false;
  }
  // Research by type
  private async execSearch(query: string): Promise<SearchResult[]> {
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
  // Search supermarkets using the search service (priority near)
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
      // Get products from current supermarket through home service
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.homeService.ui.createDataState(), 
        true, // load products
        true  // load offers
      );
      
      const allProducts = [...result.products, ...result.offerProducts];
      
      if (allProducts.length === 0) {
        return [];
      }

      const searchResults = this.filterProductsByQuery(allProducts, query);
      return searchResults.map((product: any) => ({
        id: product.barcode || product.id.toString(),
        label: product.name,
        sublabel: product.description || `€${(product.offer_price || product.price || 0).toFixed(2)}`,
        type: 'search' as const,
        icon: 'cube-outline',
        data: product
      }));
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
      // Get offers from current supermarket through home service
      const result = await this.homeService.loadSupermarketDataWithoutImages(
        this.selectedSupermarket.id, 
        this.homeService.ui.createDataState(), 
        false, // don't load regular products
        true   // load offers
      );
      
      const offers = result.offerProducts;
      
      if (offers.length === 0) {
        return [];
      }

      const searchResults = this.filterProductsByQuery(offers, query);
      return searchResults.map((product: any) => ({
        id: product.barcode || product.id.toString(),
        label: product.name,
        sublabel: `Offerta: €${(product.offer_price || product.price || 0).toFixed(2)}`,
        type: 'search' as const,
        icon: 'pricetag-outline',
        data: product
      }));
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
    }).slice(0, 8); // Limit results
  }

  // Manage result selection
  selectResult(result: SearchResult) {
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

  // Manage recent search
  private handleRecent(result: SearchResult) {
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
    
    // Handle supermarket selection from search
    if (currentType === 'supermarkets' && result.data) {
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
    
    // Handle product selection from search
    if (currentType === 'products' && result.data) {
      this.selectProductFromSearch(result.data);
    }
    
    // Handle offer selection from search
    if (currentType === 'offers' && result.data) {
      this.selectOfferFromSearch(result.data);
    }
  }

  // Select and center supermarket
  private selectSupermarketFromSearch(supermarket: any): void {
    this.homeService.supermarkets.setSelectedSupermarket(supermarket);
    window.dispatchEvent(new CustomEvent('supermarketSelectedFromSearch', {
      detail: { supermarket }
    }));
  }
  // Select and highlight product from search
  private selectProductFromSearch(product: any): void {
    window.dispatchEvent(new CustomEvent('productSelectedFromSearch', {
      detail: { product }
    }));
  }

  // Select and highlight offer from search
  private selectOfferFromSearch(product: any): void {
    window.dispatchEvent(new CustomEvent('offerSelectedFromSearch', {
      detail: { product }
    }));
  }

  onFocus() {
    // Don't activate search if no search functionality is available
    if (!this.currentPlaceholder) {
      return;
    }
    
    this.showOverlay = true;
    this.isSearchActive = true;
    
    if (this.searchTerm?.length > 0) {
      this.searchTerm = '';
      this.searchResults = [];
    }
    
    this.showRecentSearches = true;
    this.searchResults = this.combineResults([], true);
    this.showResults = this.searchResults.length > 0;
  }
  
  onBlur() {
    setTimeout(() => this.resetSearch(), 200);
  }
  clearSearch() {
    this.searchTerm = '';
    this.isSearching = false;
    this.resetSearch();
    
    // Only show recent searches if search functionality is available
    if (this.isSearchActive && this.currentPlaceholder) {
      this.showRecentSearches = true;
      this.showOverlay = true;
      this.searchResults = this.combineResults([], true);
      this.showResults = this.searchResults.length > 0;
    }
  }  
  
  onCancel() {
    // Don't process if no search functionality is available
    if (!this.currentPlaceholder) {
      return;
    }
    
    this.isSearching = false;
    this.clearSearch();
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }

  // Enter key search
  onEnter(event: any) {
    // Don't process if no search functionality is available
    if (!this.currentPlaceholder) {
      return;
    }
    
    event.preventDefault();
    if (this.searchResults && this.searchResults.length > 0) {
      this.selectResult(this.searchResults[0]);
      return;
    }
  }

  // Load home data
  private loadHome() {
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

  // Load recent search from localstorage
  private loadRecent() {
    const currentUser = this.authService.getUser();
    if (!currentUser) return;

    const key = `${this.RECENT_SEARCHES_KEY}_${currentUser.id}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      this.recentSearches = JSON.parse(stored);
    }
  }  

  // Save recent search to localstorage
  private saveRecent(query: string, type: string, result?: SearchResult) {
    const currentUser = this.authService.getUser();
    if (!currentUser) return;

    const key = `${this.RECENT_SEARCHES_KEY}_${currentUser.id}`;
    const newSearch: RecentSearch = {
      query,
      timestamp: Date.now(),
      type,
      userId: currentUser.id,
      data: result?.data,
      resultId: result?.id
    };
    this.recentSearches = this.recentSearches.filter(search => 
      search.query.toLowerCase() !== query.toLowerCase() || search.type !== type
    );
    this.recentSearches.unshift(newSearch);
    this.recentSearches = this.recentSearches.slice(0, this.MAX_RECENT_SEARCHES);
    localStorage.setItem(key, JSON.stringify(this.recentSearches));
  }  

  // Combined list
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

  // Search type
  private getSearchType(): string {
    const config = Object.entries(this.SEARCH_CONFIG).find(([path]) => 
      this.activeUrl.includes(path)
    );
    return config ? config[1].type : 'general';
  }

  // User role management
  public get isAdmin(): boolean {
    const user = this.authService.getUser();
    return this.homeService.isUserAdmin(user);
  }
  public get isManager(): boolean {
    const user = this.authService.getUser();
    return this.homeService.isUserManager(user);
  }  public get isCustomer(): boolean {
    const user = this.authService.getUser();
    return this.homeService.isUserCustomer(user);
  }

  public get isAdminOrManager(): boolean {
    const user = this.authService.getUser();
    return this.homeService.isUserAdminOrManager(user);
  }

  // Selected supermarket visibility
  shouldShowSupermarketSelection(): boolean {
    return this.activeUrl.includes('/prodotti') || this.activeUrl.includes('/offerte');
  }

  // Menu selected
  isMenuActive(path: string): boolean {
    return this.activeUrl === `/home/${path}` || (path === 'dashboard' && (this.activeUrl === '/home' || this.activeUrl === '/home/dashboard'));
  }  

  // Logout and redirect
  logout() {
    this.clearSearch();
    this.recentSearches = [];
    this.homeService.supermarkets.clearSelectedSupermarket();
    this.menuController.close();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  // Navigate and close menu
  navAndClose(route: string) {
    this.router.navigate([`/home/${route}`]);
    if (window.innerWidth < 992) {
      this.menuController.close();
    }
  }

  // Cart icon visibility
  shouldShowCartIcon(): boolean {
    return this.isCustomer && !this.activeUrl.includes('/carrello') && !this.activeUrl.includes('/ordini');
  }

  // Navigate to cart
  goToCart(): void {
    this.router.navigate(['/home/carrello']);
  }

  // Update cart count
  private updateCartCount(): void {
    this.cartItemCount = this.homeService.cart.getCartItemsCount();
  }
}
