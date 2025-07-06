import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
  arrowBack, save, search, cube, warning,
  checkmarkCircle, closeCircle, close, image 
} from 'ionicons/icons';
import { HomeService, Category } from '../../../services/home/home.service';
import { AuthService } from '../../../auth/auth.service';

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
export class CreaProdottoPage implements OnInit {
  @ViewChild('categoryList', { static: false }) categoryList!: ElementRef;

  // Product data
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
  showRateLimitAlert = false;
  rateLimitMessage = '';

  // User authentication
  currentUser: any = null;
  isAdmin = false;
  isManager = false;

  // Search variables
  searchQuery = '';
  searchResults: any[] = [];
  isSearching = false;
  showSearchResults = false;
  selectedOpenFoodProduct: any | null = null;
  lastSearchType: 'barcode' | 'name' | null = null;

  // Product categories
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

  constructor(
    private readonly homeService: HomeService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    addIcons({ 
      arrowBack, save, search, cube, warning,
      checkmarkCircle, closeCircle, close, image 
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
    this.isAdmin = this.homeService.isUserAdmin();
    this.isManager = this.homeService.isUserManager();
    
    if (!this.currentUser || !this.homeService.isUserAdminOrManager()) {
      this.router.navigate(['/home/dashboard']);
    }
  }


  // Navigate to product management
  goBack(): void {
    this.router.navigate(['/home/gestione/aggiungi-prodotto']);
  }

  // Handle search input
  onSearchInput(): void {
    if (this.showSearchResults) {
      this.showSearchResults = false;
      this.searchResults = [];
    }
  }

  // Submit search query
  onSearchSubmit(): void {
    if (!this.searchQuery || this.searchQuery.trim().length < 3) {
      return;
    }
    this.performSearch(this.searchQuery.trim());
  }

  // Execute product search
  private performSearch(query: string): void {
    const isBarcode = this.isBarcode(query);

    if (isBarcode && !this.homeService.openFoodFacts.canSearchByBarcode()) {
      this.showRateLimit('Limite ricerche prodotto raggiunto (100 al minuto). Riprova tra qualche secondo.');
      return;
    }
    
    if (!isBarcode && !this.homeService.openFoodFacts.canSearchByName()) {
      this.showRateLimit('Limite ricerche raggiunto (10 al minuto). Riprova tra qualche secondo.');
      return;
    }

    this.isSearching = true;
    this.homeService.openFoodFacts.smartSearch(query)
      .subscribe({
        next: (response: any) => this.handleSearchSuccess(response),
        error: (error: any) => this.handleSearchError(error)
      });
  }

  // Handle successful search response
  private handleSearchSuccess(response: any): void {
    this.searchResults = response.results;
    this.lastSearchType = response.type;
    this.isSearching = false;
    
    if (response.isBarcode && response.results.length === 1) {
      this.selectProduct(response.results[0]);
      this.searchQuery = '';
    } else {
      this.showSearchResults = true;
    }
  }

  // Handle search error
  private handleSearchError(error: any): void {
    console.error('Errore nella ricerca:', error);
    this.isSearching = false;
    this.showSearchResults = false;
  }

  // Check if query is barcode
  private isBarcode(query: string): boolean {
    const cleanQuery = query.replace(/[\s-]/g, '');
    const isNumericOnly = /^\d+$/.test(cleanQuery);
    const hasValidLength = cleanQuery.length >= 8 && cleanQuery.length <= 14;
    
    return isNumericOnly && hasValidLength;
  }
  
  // Select product from search results
  selectProduct(product: any): void {
    this.selectedOpenFoodProduct = product;
    this.product.name = this.homeService.openFoodFacts.getBestProductName(product);
    this.product.barcode = product.code;
    
    const categories = this.homeService.openFoodFacts.getCategories(product);
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
    
    this.showSearchResults = false;
    
    if (categoryMapped && this.product.category) {
      this.scrollToCategorySelection();
    }
  }

  // Clear search data
  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.selectedOpenFoodProduct = null;
    this.lastSearchType = null;
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

  // Get category icon path
  getCategoryIcon(category: Category): string {
    return `assets/categories/${category.icon}`;
  }

  // Select a product category
  selectCategory(categoryName: string): void {
    this.product.category = categoryName;
    this.scrollToCategorySelection();
  }

  // Scroll to selected category
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
          categoryContainer.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }

  // Create new product
  async createProduct(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    try {
      const response = await this.homeService.products.createProduct(this.product);

      if (response) {
        this.showAlert('success', 'Successo', 'Prodotto creato con successo!', 'checkmark-circle');
        setTimeout(() => {
          this.router.navigate(['/home/gestione/aggiungi-prodotto']);
        }, 1500);
      } else {
        this.showAlert('error', 'Errore', 'Errore nella creazione del prodotto', 'close-circle');
      }
    } catch (error: any) {
      console.error('Errore nella creazione del prodotto:', error);
      
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

  // Validate form data
  private validateForm(): boolean {
    if (!this.product.name.trim()) {
      this.showAlert('error', 'Errore', 'Il nome del prodotto è obbligatorio', 'close-circle');
      return false;
    }

    if (!this.product.barcode.trim()) {
      this.showAlert('error', 'Errore', 'Il codice a barre è obbligatorio', 'close-circle');
      return false;
    }

    if (this.product.barcode.length > 13) {
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

  // Check if form is valid
  isFormValid(): boolean {
    return !!(
      this.product.name.trim() &&
      this.product.barcode.trim() && 
      this.product.barcode.length <= 13 &&
      /^\d+$/.test(this.product.barcode) &&
      this.product.description.trim() &&
      this.product.category
    );
  }

  // Show alert message
  private showAlert(type: 'success' | 'error', title: string, message: string, icon: string): void {
    this.alertType = type;
    this.alertTitle = title;
    this.alertMessage = message;
    this.alertIcon = icon;
    this.showCustomAlert = true;
  }

  // Close alert dialog
  closeAlert(): void {
    this.showCustomAlert = false;
  }

  // Show rate limit message
  private showRateLimit(message: string): void {
    this.rateLimitMessage = message;
    this.showRateLimitAlert = true;
    setTimeout(() => {
      this.showRateLimitAlert = false;
    }, 4000);
  }

  // Dismiss rate limit alert
  dismissRateLimitAlert(): void {
    this.showRateLimitAlert = false;
  }

  // Handle form click events
  onFormClick(event: Event): void {
    if (!(event.target as HTMLElement).closest('.search-container')) {
      this.showSearchResults = false;
    }
  }

  // Get best product name from OpenFoodFacts
  getBestProductName(product: any): string {
    return this.homeService.openFoodFacts.getBestProductName(product);
  }

  // Get product image URL from OpenFoodFacts
  getProductImageUrl(product: any): string | null {
    return this.homeService.openFoodFacts.getBestImageUrl(product);
  }
}
