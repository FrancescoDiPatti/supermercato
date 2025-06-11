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
  MenuController
} from '@ionic/angular/standalone';
import { HomeService, SearchResult, RecentSearch } from './home.service';
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
    IonItem
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
  private searchSubject = new Subject<string>();  
  private subscription: Subscription = new Subscription();
  private readonly RECENT_SEARCHES_KEY = 'recentSearches';
  private readonly MAX_RECENT_SEARCHES = 5;

  private readonly SEARCH_CONFIG = {
    '/supermercati': { placeholder: 'Cerca supermercati', type: 'supermarkets' },
    '/prodotti': { placeholder: 'Cerca prodotti', type: 'products' },
    '/offerte': { placeholder: 'Cerca offerte', type: 'offers' },
    '/ordini': { placeholder: 'Cerca ordini', type: 'orders' },
    '/dashboard': { placeholder: '', type: 'general' },
    '/carrello': { placeholder: '', type: 'general' }
  } as const;
  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef,
    private menuController: MenuController
  ) {    
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
      searchOutline
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
  }
  ngOnDestroy() {
    this.subscription.unsubscribe();
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
  }

  private setupUserListener() {
    const handleUserChange = (event: any) => {
      if (event.detail.action === 'login') {
        this.resetSearch();
        this.recentSearches = [];
        this.loadRecent();
      }
    };
    window.addEventListener('userChanged', handleUserChange);
    this.subscription.add({
      unsubscribe: () => {
        window.removeEventListener('userChanged', handleUserChange);
      }
    } as any);
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
    const query = event.target.value;
    this.searchTerm = query;
    
    if (query.length >= 2) {
      this.showRecentSearches = false;
      this.searchSubject.next(query);
    } else if (query.length === 0) {
      this.showRecentSearches = true;
      this.searchResults = this.combineResults([], true);
      this.showResults = this.searchResults.length > 0;
    } else {
      this.resetSearch();
    }
  }

  // Reset search
  private resetSearch() {
    this.searchResults = [];
    this.showResults = false;
    this.showRecentSearches = false;
    this.showOverlay = false;
    this.isSearchActive = false;
  }  
  private async search(query: string) {
    if (!query?.trim()) {
      this.resetSearch();
      this.isSearching = false;
      return;
    }    
    this.isSearching = true;
    this.showRecentSearches = false;
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
      case 'supermarkets':
        return this.customSearch(query, 'supermarkets');
      case 'products':
        // TODO: Implement products search
        return [];
      case 'offers':
        // TODO: Implement offers search
        return [];
      default:
        return [];
    }
  }
  
  // General research
  private async customSearch(query: string, type: string): Promise<SearchResult[]> {
    const event = new CustomEvent('universalSearch', { 
      detail: { query, type } 
    });
    window.dispatchEvent(event);
    
    return new Promise((resolve) => {
      const handler = (event: any) => {
        if (event.detail.type === type) {
          window.removeEventListener('universalSearchResults', handler);
          resolve(event.detail.results);
        }
      };
      window.addEventListener('universalSearchResults', handler);
    });
  }  

  // Manage result selection
  selectResult(result: SearchResult) {
    this.searchTerm = result.label;
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
    
    if (currentType === 'supermarkets') {
      const event = new CustomEvent('universalSearchSelect', {
        detail: { result, type: 'supermarkets' }
      });
      window.dispatchEvent(event);
    }
    // Products and offers here
  }  

  onFocus() {
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
    this.resetSearch();
      if (this.isSearchActive) {
      this.showRecentSearches = true;
      this.searchResults = this.combineResults([], true);
      this.showResults = this.searchResults.length > 0;
    }
  }
  
  onCancel() {
    this.clearSearch();
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }

  // Enter key search
  onEnter(event: any) {
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
    this.authService.clearHomeData();    
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
    return HomeService.isAdmin(user);
  }
  public get isManager(): boolean {
    const user = this.authService.getUser();
    return HomeService.isManager(user);
  }
  public get isCustomer(): boolean {
    const user = this.authService.getUser();
    return HomeService.isCustomer(user);
  }

  // Menu selected
  isMenuActive(path: string): boolean {
    return this.activeUrl === `/home/${path}` || (path === 'dashboard' && (this.activeUrl === '/home' || this.activeUrl === '/home/dashboard'));
  }  

  // Logout and redirect
  logout() {
    this.clearSearch();
    this.recentSearches = [];
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  // Navigate and close menu
  navAndClose(route: string) {
    this.router.navigate([`/home/${route}`]);
    if (window.innerWidth < 768) {
      this.menuController.close();
    }
  }
}
