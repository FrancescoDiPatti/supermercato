import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HomeService, SupermarketDataState, AnimationState } from '../../../services/home/home.service';
import { 
  IonContent, IonIcon, IonImg, IonBadge, IonFabButton, IonButton, 
  IonHeader, IonToolbar, IonButtons, IonTitle, IonInput, IonList, 
  IonItem, IonLabel, IonThumbnail, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, remove, save, storefront, arrowForward } from 'ionicons/icons';
import { AlertController } from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-aggiungi-prodotto',
  templateUrl: './aggiungi-prodotto.page.html',
  styleUrls: ['./aggiungi-prodotto.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    IonContent, IonIcon, IonImg, IonBadge, IonFabButton,
    IonButton, IonHeader, IonToolbar, IonButtons,
    IonTitle, IonInput, IonList, IonItem, IonLabel,
    IonThumbnail, IonSpinner
  ]
})
export class AggiungiProdottoPage implements OnInit, OnDestroy {
  @ViewChild('categoryList') categoryList!: ElementRef;

  // State properties
  public categories: any[] = [];
  public selectedCategory: string = '';
  public displayProducts: any[] = [];
  public allProducts: any[] = [];
  public canCreateContent = false;
  public isLoading = false;
  public isLoadingProducts = false;
  public SelectedProduct = false;
  public selectedProducts: any[] = [];
  public showCustomAlert = false;
  public alertType: 'success' | 'error' = 'success';
  public alertIcon: string = '';
  public alertTitle: string = '';
  public alertMessage: string = '';
  public selectedSupermarket: any = null;

  // Quantity management
  public quantities: { [barcode: string]: number } = {};

  // Internal state
  private scrollListeners: Array<{ element: Element; listener: EventListener }> = [];
  private dataState: SupermarketDataState;
  private animationState: AnimationState;

  constructor(
    private readonly http: HttpClient,
    private readonly alertController: AlertController,
    private readonly homeService: HomeService,
    private readonly router: Router
  ) {
    this.dataState = this.homeService.ui.createDataState();
    this.animationState = this.homeService.ui.createAnimationState();
    addIcons({ add, remove, save, storefront, arrowForward });
  }

  // Window resize listener to reinitialize scroll
  @HostListener('window:resize', ['$event'])
  onResize(): void {
    setTimeout(() => this.setupHorizontalScroll(), 300);
  }

  ngOnInit(): void {
    this.isLoadingProducts = true;
    this.loadProducts();
    this.initializeQuantities();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.setupHorizontalScroll(), 500);
  }

  ngOnDestroy(): void {
    this.homeService.ui.clearTimer();
    this.homeService.ui.removeScrollListeners(this.scrollListeners);
  }

  // Currency format
  private formatNumber(n: string): string {
    return n.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Format price input
  private formatPrice(input: string, addDecimals: boolean = false): string {
    let formatted = input.replace(/€/g, '');
    if (!formatted) return '';
    
    if (formatted.indexOf(",") >= 0) {
      const decimalPos = formatted.indexOf(",");
      let leftSide = formatted.substring(0, decimalPos);
      let rightSide = formatted.substring(decimalPos + 1);
      leftSide = this.formatNumber(leftSide);
      rightSide = this.formatNumber(rightSide);
      if (addDecimals) {
        rightSide += "00";
      }
      rightSide = rightSide.substring(0, 2);
      formatted = "€ " + leftSide + "," + rightSide;
    } else {
      formatted = this.formatNumber(formatted);
      if (addDecimals) {
        formatted += ",00";
      }
      formatted = "€ " + formatted;
    }
    return formatted;
  }

  // Format currency input
  formatCurrency(event: any, product: any): void {
    const input = event.target.value;
    product.price = this.formatPrice(input);
  }

  // Parse currency string to number
  private parseCurrency(price: string): number {
    price = price.replace(/€|\s/g, '');
    const cleaned = price.replace(/[^\d,]/g, '');
    return parseFloat(cleaned.replace(',', '.'));
  }

  // Show alert message
  private showAlert(message: string, title: string = 'Errore', icon: string = 'close-circle'): void {
    this.alertMessage = message;
    this.alertTitle = title;
    this.alertIcon = title === 'Successo' ? 'checkmark-circle' : 'close-circle';
    this.alertType = title === 'Successo' ? 'success' : 'error';
    this.showCustomAlert = true;
  }

  // Close alert
  closeAlert(): void {
    this.showCustomAlert = false;
  }

  // Add products to supermarket
  async AddProduct(): Promise<void> {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      const selectedSupermarket = this.homeService.supermarkets.getSelectedSupermarket();

      if (!selectedSupermarket) {
        throw new Error('Nessun supermercato selezionato');
      }

      const productsToAdd = this.selectedProducts.map(product => ({
        id: product.id,
        price: this.quantities[product.barcode] ? this.parseCurrency(product.price) : 0,
        quantity: this.quantities[product.barcode] || 0
      }));

      const response = await this.homeService.supermarkets.addProductsToSupermarket(selectedSupermarket.id, productsToAdd);

      if (response?.success) {
        this.showAlert('Prodotti aggiunti con successo!', 'Successo', 'checkmark-circle');
        setTimeout(() => {
          this.router.navigate(['/home/dashboard']);
        }, 2000);
      } else {
        throw new Error('Error on adding product');
      }
    } catch (error: any) {
      console.error('Error on adding product:', error);
      let errorMessage = 'Errore nell\'aggiunta dei prodotti';
      
      if (error?.error?.error) {
        errorMessage = error.error.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      this.showAlert(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  // Product management
  private initializeQuantities(): void {
    this.displayProducts.forEach(product => {
      if (!this.quantities[product.barcode]) {
        this.quantities[product.barcode] = 0;
      }
    });
  }

  private async loadProducts(): Promise<void> {
    try {
      this.isLoadingProducts = true;
      this.selectedSupermarket = this.homeService.supermarkets.getSelectedSupermarket();
      if (!this.selectedSupermarket) {
        this.allProducts = [];
        this.categories = [];
        this.displayProducts = [];
        return;
      }

      const allProducts = await this.homeService.products.loadDashboardProducts();
      const supermarketProducts = await this.homeService.products.loadSupermarketProducts(this.selectedSupermarket.id, false);
      const supermarketProductIds = new Set(supermarketProducts.map((p: any) => p.id));
      
      this.allProducts = allProducts.filter((product: any) => !supermarketProductIds.has(product.id));
      this.setupCategories();
      this.onCategorySelect('');
      
      // Setup horizontal scroll after products are loaded
      setTimeout(() => this.setupHorizontalScroll(), 100);
    } catch (error) {
      console.error('Error loading products:', error);
      this.allProducts = [];
      this.categories = [];
      this.displayProducts = [];
      this.showAlert('Errore nel caricamento dei prodotti', 'Errore');
    } finally {
      this.isLoadingProducts = false;
      // Setup scroll again after loading state changes
      setTimeout(() => this.setupHorizontalScroll(), 200);
    }
  }

  private setupCategories(): void {
    const categoryMap = new Map<string, { name: string, icon: string, count: number }>();
    
    this.allProducts.forEach(product => {
      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, {
          name: product.category,
          icon: this.homeService.products.getCategoryIcon(product.category),
          count: 1
        });
      } else {
        categoryMap.get(product.category)!.count++;
      }
    });
    
    this.categories = Array.from(categoryMap.values());
  }

  // Category selection
  onCategorySelect(category: string): void {
    this.selectedCategory = category;
    this.displayProducts = category 
      ? this.allProducts.filter(p => p.category === category)
      : this.allProducts;
    this.initializeQuantities();
    
    // Setup horizontal scroll after category change
    setTimeout(() => this.setupHorizontalScroll(), 100);
  }

  // Price display utilities
  getDisplayPrice(product: any): number {
    return product.offer_price ?? product.price ?? 0;
  }

  getOriginalPrice(product: any): number | null {
    return product.offer_price ? product.price : null;
  }

  // Quantity management
  clearProduct(barcode: string): void {
    this.updateQuantity(barcode, -(this.quantities[barcode] || 0));
  }

  handleQuantityClick(barcode: string, amount: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.updateQuantity(barcode, amount);
  }

  incrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, 1); 
  }
  
  decrementQuantity(barcode: string): void { 
    this.updateQuantity(barcode, -1); 
  }
  
  onIncrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  onDecrementPress(barcode: string): void { 
    this.homeService.ui.startTimer(barcode, false, this.updateQuantity.bind(this));
  }
  
  onButtonRelease(): void { 
    this.homeService.ui.clearTimer();
  }

  private updateQuantity(barcode: string, amount: number): void {
    const result = this.homeService.ui.updateQuantity(this.quantities, barcode, amount);
    this.quantities = { ...result.quantities };
    this.updateSelectedProductStatus();
  }

  private updateSelectedProductStatus(): void {
    this.selectedProducts = this.allProducts.filter(p => (this.quantities[p.barcode] ?? 0) > 0);
    this.SelectedProduct = this.selectedProducts.length > 0;
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/home/dashboard']);
  }

  goToDashboard(): void {
    this.router.navigate(['/home/dashboard']);
  }

  onCreateProduct(): void {
    this.router.navigate(['/home/gestione/crea-prodotto']);
  }

  // Horizontal scroll setup
  private setupHorizontalScroll(): void {
    if (!this.displayProducts.length) {
      return;
    }
    
    this.homeService.ui.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    
    const scrollableContainers = '.products-container, .categories-container';
    this.scrollListeners = this.homeService.ui.setupHorizontalScroll(scrollableContainers);
  }

  // Image error handling
  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }
  
  // Check if products can be added
  canAddProducts(): boolean {
    if (this.isLoading) {
      return false;
    }
    if (!this.selectedProducts.length) {
      return false;
    }
    return this.selectedProducts.every(p => {
      const priceValue = p.price ? this.parseCurrency(p.price) : 0;
      return priceValue > 0;
    });
  }
}
