import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
  IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText,
  IonList, IonRadioGroup, IonRadio, IonImg,
  IonThumbnail, IonSearchbar, IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack, save, search, cube, 
  checkmarkCircle, closeCircle, close, image 
} from 'ionicons/icons';
import { HomeService, Category } from '../../home.service';
import { AuthService } from '../../../auth/auth.service';
import { OpenFoodFactsService, OpenFoodFactsProduct } from '../../../services/openfoodfacts.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-crea-prodotto',
  templateUrl: './crea-prodotto.page.html',
  styleUrls: ['./crea-prodotto.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
    IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText,
    IonList, IonRadioGroup, IonRadio, IonImg,
    IonThumbnail, IonSearchbar, IonNote,
    CommonModule, FormsModule
  ]
})
export class CreaProdottoPage implements OnInit, OnDestroy {
  @ViewChild('categoryList', { static: false }) categoryList!: ElementRef;

  product = {
    name: '',
    description: '',
    category: '',
    barcode: ''
  };

  // UI state
  isLoading = false;
  showCustomAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' = 'success';
  alertTitle = '';
  alertIcon = '';
  // User data
  currentUser: any = null;
  isAdmin = false;
  isManager = false;

  // OpenFoodFacts integration
  searchQuery = '';
  searchResults: OpenFoodFactsProduct[] = [];
  isSearching = false;
  showSearchResults = false;
  selectedOpenFoodProduct: OpenFoodFactsProduct | null = null;
  lastSearchType: 'barcode' | 'name' | null = null;
    // Rate limiting alerts
  showRateLimitAlert = false;
  rateLimitMessage = '';

  // Categories - Allineate con la dashboard
  categories: Category[] = [
    { name: 'Frutta', icon: 'fruit.png', count: 0 },
    { name: 'Verdura', icon: 'cabbage.png', count: 0 },
    { name: 'Carne', icon: 'meat.png', count: 0 },
    { name: 'Pesce', icon: 'seafood.png', count: 0 },
    { name: 'Panetteria', icon: 'bread.png', count: 0 },
    { name: 'Latticini', icon: 'milk.png', count: 0 },
    { name: 'Bevande', icon: 'drinks.png', count: 0 },
    { name: 'Alcolici', icon: 'wine-bottle.png', count: 0 },
    { name: 'Snack', icon: 'snacks.png', count: 0 },
    { name: 'Biscotti', icon: 'cookies.png', count: 0 },
    { name: 'Pasticceria', icon: 'cake.png', count: 0 },
    { name: 'Cereali', icon: 'cereal.png', count: 0 },
    { name: 'Riso', icon: 'rice.png', count: 0 },
    { name: 'Pasta', icon: 'spaghetti.png', count: 0 },
    { name: 'Condimenti', icon: 'ketchup.png', count: 0 },
    { name: 'Casa', icon: 'cleaning-tools.png', count: 0 },
    { name: 'Igiene', icon: 'soap.png', count: 0 },
    { name: 'Cosmetici', icon: 'cosmetology.png', count: 0 },
    { name: 'Animali', icon: 'pet-food.png', count: 0 },
    { name: 'Mobili', icon: 'furniture.png', count: 0 },
    { name: 'Elettronica', icon: 'smart-tv.png', count: 0 },
    { name: 'Vestiti', icon: 'clothes-hanger.png', count: 0 },
    { name: 'Surgelati', icon: 'fish.png', count: 0 },
    { name: 'Giardinaggio', icon: 'shovel.png', count: 0 },
    { name: 'Altro', icon: 'packing.png', count: 0 }
  ];

  // Reactive streams
  private readonly destroy$ = new Subject<void>();  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    public openFoodFactsService: OpenFoodFactsService,
    private router: Router
  ) {addIcons({ 
      arrowBack, save, search, cube, 
      checkmarkCircle, closeCircle, close, image 
    });
  }
  ngOnInit() {
    this.initializeComponent();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }  // ===== INITIALIZATION =====
  private initializeComponent(): void {
    this.currentUser = this.authService.getUser();
    this.isAdmin = this.homeService.isUserAdmin();
    this.isManager = this.homeService.isUserManager();
    
    if (!this.currentUser || !this.homeService.isUserAdminOrManager()) {
      this.router.navigate(['/home/dashboard']);
    }
  }

  // ===== NAVIGATION =====
  goBack(): void {
    this.router.navigate(['/home/dashboard']);
  }  // ===== PRODUCT SEARCH =====
  onSearchInput(): void {
    if (this.showSearchResults) {
      this.showSearchResults = false;
      this.searchResults = [];
    }
  }

  onSearchSubmit(): void {
    if (!this.searchQuery || this.searchQuery.trim().length < 3) {
      return;
    }
    this.performSearch(this.searchQuery.trim());
  }

  private performSearch(query: string): void {
    // Determina il tipo di ricerca e verifica i limiti
    const isBarcode = this.isLikelyBarcode(query);
    
    if (isBarcode && !this.openFoodFactsService.canSearchByBarcode()) {
      this.showRateLimit('Limite ricerche prodotto raggiunto (100 al minuto). Riprova tra qualche secondo.');
      return;
    }
    
    if (!isBarcode && !this.openFoodFactsService.canSearchByName()) {
      this.showRateLimit('Limite ricerche raggiunto (10 al minuto). Riprova tra qualche secondo.');
      return;
    }

    this.isSearching = true;
    this.openFoodFactsService.smartSearch(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({        next: (response: any) => {
          this.searchResults = response.results;
          this.lastSearchType = response.type;
          this.isSearching = false;
            if (response.isBarcode && response.results.length === 1) {
            this.selectProduct(response.results[0]);
            this.searchQuery = '';
          } else {
            this.showSearchResults = true;
          }
        },
        error: (error: any) => {
          console.error('Errore nella ricerca:', error);
          this.isSearching = false;
          this.showSearchResults = false;        }
      });
  }
  private isLikelyBarcode(query: string): boolean {
    // Rimuove spazi e trattini
    const cleanQuery = query.replace(/[\s-]/g, '');
    
    // Un barcode deve essere:
    // - SOLO numerico (nessun carattere alfabetico)
    // - Lunghezza appropriata (8-14 caratteri)
    const isNumericOnly = /^\d+$/.test(cleanQuery);
    const hasValidLength = cleanQuery.length >= 8 && cleanQuery.length <= 14;
    
    return isNumericOnly && hasValidLength;
  }  selectProduct(product: OpenFoodFactsProduct): void {
    this.selectedOpenFoodProduct = product;
    this.product.name = this.openFoodFactsService.getBestProductName(product);
    this.product.barcode = product.code;
    const categories = this.openFoodFactsService.getMainCategories(product);
    let categoryMapped = false;
    
    for (const category of categories) {
      this.mapCategoryFromOpenFoodFacts(category);
      if (this.product.category) {
        categoryMapped = true;
        break;
      }
    }
    if (product.brands) {
      this.product.description = `Marca: ${product.brands}`;
    }
    this.showSearchResults = false;    // Se è stata mappata una categoria, scorri per mostrarla
    if (categoryMapped && this.product.category) {
      this.scrollToCategorySelection();
    }
  }
  private mapCategoryFromOpenFoodFacts(openFoodCategory: string): void {
    const categoryMappings: { [key: string]: string } = {
      // Frutta
      'fruits': 'Frutta',
      'fresh fruits': 'Frutta',
      'citrus fruits': 'Frutta',
      'dried fruits': 'Frutta',
      'tropical fruits': 'Frutta',
      'berries': 'Frutta',
      'apples': 'Frutta',
      'bananas': 'Frutta',
      'oranges': 'Frutta',
      
      // Verdura
      'vegetables': 'Verdura',
      'fresh vegetables': 'Verdura',
      'leafy vegetables': 'Verdura',
      'root vegetables': 'Verdura',
      'legumes': 'Verdura',
      'tomatoes': 'Verdura',
      'potatoes': 'Verdura',
      'onions': 'Verdura',
      'carrots': 'Verdura',
      'salads': 'Verdura',
      
      // Carne
      'meats': 'Carne',
      'fresh meat': 'Carne',
      'poultry': 'Carne',
      'pork': 'Carne',
      'beef': 'Carne',
      'lamb': 'Carne',
      'sausages': 'Carne',
      'cold cuts': 'Carne',
      'charcuterie': 'Carne',
      'deli meats': 'Carne',
      
      // Pesce
      'fish': 'Pesce',
      'seafood': 'Pesce',
      'shellfish': 'Pesce',
      'canned fish': 'Pesce',
      'smoked fish': 'Pesce',
      'fresh fish': 'Pesce',
      
      // Panetteria
      'breads': 'Panetteria',
      'bakery products': 'Panetteria',
      'fresh breads': 'Panetteria',
      'sandwich breads': 'Panetteria',
      'rusks': 'Panetteria',
      'breadcrumbs': 'Panetteria',
      
      // Latticini
      'dairy products': 'Latticini',
      'milk': 'Latticini',
      'cheeses': 'Latticini',
      'yogurts': 'Latticini',
      'butter': 'Latticini',
      'cream': 'Latticini',      
      'fresh dairy products': 'Latticini',
      'fermented milk products': 'Latticini',
      'fermented dairy products': 'Latticini',
      
      // Bevande
      'beverages': 'Bevande',
      'drinks': 'Bevande',
      'waters': 'Bevande',
      'fruit juices': 'Bevande',
      'soft drinks': 'Bevande',
      'tea': 'Bevande',
      'coffee': 'Bevande',
      'energy drinks': 'Bevande',
      'sports drinks': 'Bevande',
      
      // Alcolici
      'alcoholic beverages': 'Alcolici',
      'wines': 'Alcolici',
      'beers': 'Alcolici',
      'spirits': 'Alcolici',
      'liqueurs': 'Alcolici',
      
      // Snack
      'snacks': 'Snack',
      'sweet snacks': 'Snack',
      'salty snacks': 'Snack',
      'chips': 'Snack',
      'nuts': 'Snack',
      'crackers': 'Snack',
      'popcorn': 'Snack',
      
      // Biscotti
      'biscuits': 'Biscotti',
      'cookies': 'Biscotti',
      'wafers': 'Biscotti',
      'shortbread': 'Biscotti',
      
      // Pasticceria
      'cakes': 'Pasticceria',
      'desserts': 'Pasticceria',
      'pastries': 'Pasticceria',
      'chocolates': 'Pasticceria',
      'chocolate products': 'Pasticceria',
      'ice cream': 'Pasticceria',
      'frozen desserts': 'Pasticceria',
      'confectioneries': 'Pasticceria',
      'sweet spreads': 'Pasticceria',
      
      // Cereali
      'cereals': 'Cereali',
      'breakfast cereals': 'Cereali',
      'mueslis': 'Cereali',
      'granola': 'Cereali',
      'oats': 'Cereali',
      'corn flakes': 'Cereali',
      
      // Riso
      'rice': 'Riso',
      'rice products': 'Riso',
      
      // Pasta
      'pasta': 'Pasta',
      'fresh pasta': 'Pasta',
      'dried pasta': 'Pasta',
      'noodles': 'Pasta',
      
      // Condimenti
      'condiments': 'Condimenti',
      'sauces': 'Condimenti',
      'dressings': 'Condimenti',
      'spices': 'Condimenti',
      'herbs': 'Condimenti',
      'vinegars': 'Condimenti',
      'oils': 'Condimenti',
      'honey': 'Condimenti',
      'jams': 'Condimenti',
      'preserves': 'Condimenti',
      'mustards': 'Condimenti',
      'ketchup': 'Condimenti',
      'mayonnaise': 'Condimenti',
      
      // Casa
      'household products': 'Casa',
      'cleaning products': 'Casa',
      'detergents': 'Casa',
      'dishwashing': 'Casa',
      'laundry': 'Casa',
      
      // Igiene
      'hygiene': 'Igiene',
      'personal care': 'Igiene',
      'oral care': 'Igiene',
      'toothpaste': 'Igiene',
      'soaps': 'Igiene',
      'shampoos': 'Igiene',
      'body care': 'Igiene',
      
      // Cosmetici
      'cosmetics': 'Cosmetici',
      'beauty products': 'Cosmetici',
      'skincare': 'Cosmetici',
      'makeup': 'Cosmetici',
      'fragrances': 'Cosmetici',
      
      // Animali
      'pet food': 'Animali',
      'dog food': 'Animali',
      'cat food': 'Animali',
      'pet care': 'Animali',
      
      // Surgelati      
      'frozen foods': 'Surgelati',
      'frozen vegetables': 'Surgelati',
      'frozen fruits': 'Surgelati',
      'frozen fish': 'Surgelati',
      'frozen meals': 'Surgelati',
      'ice': 'Surgelati',

    };
    const lowerCategory = openFoodCategory.toLowerCase().trim();
    if (categoryMappings[lowerCategory]) {
      this.product.category = categoryMappings[lowerCategory];
      return;
    }
    const sortedKeys = Object.keys(categoryMappings).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (lowerCategory.includes(key)) {
        this.product.category = categoryMappings[key];
        return;
      }
    }
    for (const [key, value] of Object.entries(categoryMappings)) {
      if (key.includes(lowerCategory) && lowerCategory.length >= 4){
        this.product.category = value;
        return;
      }
    }
  }
  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.selectedOpenFoodProduct = null;
    this.lastSearchType = null;
    
    // Opzionalmente, potresti voler mantenere i dati già inseriti
    // o chiedere conferma prima di cancellarli
  }
  // ===== CATEGORY SELECTION =====
  getCategoryIcon(category: Category): string {
    return `assets/categories/${category.icon}`;
  }  selectCategory(categoryName: string): void {
    this.product.category = categoryName;
    this.scrollToCategorySelection();
  }
  private scrollToCategorySelection(): void {
    if (this.product.category) {
      setTimeout(() => {
        const selectedElement = document.querySelector('.category-list-item.selected') as HTMLElement;
        const categoryContainer = document.querySelector('.category-list') as HTMLElement;
        if (selectedElement && categoryContainer) {
          const containerHeight = categoryContainer.clientHeight;
          const elementTop = selectedElement.offsetTop;
          const elementHeight = selectedElement.offsetHeight;
          const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
          categoryContainer.scrollTo({top: Math.max(0, scrollTop),behavior: 'smooth'});
        }
      }, 100);
    }
  }
  // ===== FORM SUBMISSION =====
  async createProduct(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;

    try {
      const response = await this.homeService.createProduct(this.product);

      if (response) {
        this.showAlert('success', 'Successo', 'Prodotto creato con successo!', 'checkmark-circle');
        setTimeout(() => {
          this.router.navigate(['/home/dashboard']);
        }, 2000);
      } else {
        this.showAlert('error', 'Errore', 'Errore nella creazione del prodotto', 'close-circle');
      }
    } catch (error: any) {
      console.error('Errore nella creazione del prodotto:', error);
      
      // Handle different error types
      let errorMessage = 'Errore di connessione al server';
      if (error?.error?.error) {
        errorMessage = error.error.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      this.showAlert('error', 'Errore', errorMessage, 'close-circle');
    } finally {
      this.isLoading = false;
    }
  }
  private validateForm(): boolean {
    if (!this.product.name.trim()) {
      this.showAlert('error', 'Errore', 'Il nome del prodotto è obbligatorio', 'close-circle');
      return false;
    }

    if (!this.product.barcode.trim()) {
      this.showAlert('error', 'Errore', 'Il codice a barre è obbligatorio', 'close-circle');
      return false;
    }    if (this.product.barcode.length > 13) {
      this.showAlert('error', 'Errore', 'Il codice a barre deve essere massimo 13 caratteri', 'close-circle');
      return false;
    }

    if (!/^\d+$/.test(this.product.barcode)) {
      this.showAlert('error', 'Errore', 'Il codice a barre deve contenere solo numeri', 'close-circle');
      return false;
    }

    if (!this.product.description.trim()) {
      this.showAlert('error', 'Errore', 'La descrizione del prodotto è obbligatoria', 'close-circle');
      return false;
    }

    if (!this.product.category) {
      this.showAlert('error', 'Errore', 'Seleziona una categoria', 'close-circle');
      return false;
    }

    return true;
  }
  // Metodo per verificare se il form è valido (per abilitare/disabilitare il pulsante)
  isFormValid(): boolean {
    return !!(
      this.product.name.trim() &&
      this.product.barcode.trim() && 
      this.product.barcode.length <= 13 && // E massimo 13 caratteri
      /^\d+$/.test(this.product.barcode) && // Solo numeri
      this.product.description.trim() &&
      this.product.category
    );
  }
  // ===== ALERT SYSTEM =====
  private showAlert(type: 'success' | 'error', title: string, message: string, icon: string): void {
    this.alertType = type;
    this.alertTitle = title;
    this.alertMessage = message;
    this.alertIcon = icon;
    this.showCustomAlert = true;
  }

  closeAlert(): void {
    this.showCustomAlert = false;  }  // ===== UTILITIES =====
  onFormClick(event: Event): void {
    // Chiude i suggerimenti quando si clicca altrove nel form
    if (!(event.target as HTMLElement).closest('.search-container')) {
      this.showSearchResults = false;
    }
  }

  getBestProductName(product: OpenFoodFactsProduct): string {
    return this.openFoodFactsService.getBestProductName(product);
  }

  getProductImageUrl(product: OpenFoodFactsProduct): string | null {
    return this.openFoodFactsService.getBestImageUrl(product);
  }

  // ===== RATE LIMITING ALERTS =====
  private showRateLimit(message: string): void {
    this.rateLimitMessage = message;
    this.showRateLimitAlert = true;
    setTimeout(() => {
      this.showRateLimitAlert = false;
    }, 3000);
  }
  dismissRateLimitAlert(): void {
    this.showRateLimitAlert = false;  }
}
