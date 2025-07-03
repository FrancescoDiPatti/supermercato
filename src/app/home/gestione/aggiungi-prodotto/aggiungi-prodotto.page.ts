import { Component, OnInit, HostListener, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { HomeService, Product, Category } from '../../home.service';
import { AuthService } from '../../../auth/auth.service';
import { 
  IonContent, IonIcon, IonImg, IonBadge, IonFabButton, IonButton, IonHeader, IonToolbar, IonButtons, IonTitle, IonInput, IonList, IonItem, IonLabel, IonThumbnail, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, remove, save } from 'ionicons/icons';
import { AlertController } from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../config/api.config';
import { ActivatedRoute } from '@angular/router';

import { ProdottiService } from '../../../services/prodotti/prodotti.service';
import { SupermarketDataState, AnimationState } from '../../../services/ui/ui.service';

@Component({
  selector: 'app-aggiungi-prodotto',
  templateUrl: './aggiungi-prodotto.page.html',
  styleUrls: ['./aggiungi-prodotto.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent,
    IonIcon,
    IonImg,
    IonBadge,
    IonFabButton,
    IonButton,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonInput,
    IonList,
    IonItem,
    IonLabel,
    IonThumbnail,
    IonSpinner,

  ]
})
export class AggiungiProdottoPage implements OnInit, OnDestroy {
  formatNumber(n: string): string {
    return n.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  }

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

  formatCurrency(event: any, product: any) {
    const input = event.target.value;
    product.price = this.formatPrice(input);
  }

  parseCurrency(price: string): number {
    price = price.replace(/€|\s/g, '');
    const cleaned = price.replace(/[^\d,]/g, '');
    return parseFloat(cleaned.replace(',', '.'));
  }

  private async showAlert(message: string, title: string = 'Errore', icon: string = 'close-circle') {
    this.alertMessage = message;
    this.alertTitle = title;
    this.alertIcon = title === 'Successo' ? 'checkmark-circle' : 'close-circle';
    this.alertType = title === 'Successo' ? 'success' : 'error';
    this.showCustomAlert = true;
  }

  closeAlert() {
    this.showCustomAlert = false;
  }

  async AddProduct() {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      
      // Get selected supermarket
      const selectedSupermarket = this.homeService.getSelectedSupermarket();
      if (!selectedSupermarket) {
        throw new Error('Nessun supermercato selezionato');
      }

      // Prepare products data
      const productsToAdd = this.selectedProducts.map(product => ({
        id: product.id,
        price: this.quantities[product.barcode] ? this.parseCurrency(product.price) : 0,
        quantity: this.quantities[product.barcode] || 0
      }));

      // Add products to supermarket using HomeService
      const response = await this.homeService.addProductsToSupermarket(selectedSupermarket.id, productsToAdd);

      if (response?.success) {
        this.showAlert('Prodotti aggiunti con successo!', 'Successo', 'checkmark-circle');
        setTimeout(() => {
          this.router.navigate(['/home/dashboard']);
        }, 2000);
      } else {
        throw new Error('Errore nell\'aggiunta dei prodotti');
      }
    } catch (error: any) {
      console.error('Errore nell\'aggiunta dei prodotti:', error);
      
      // Handle different error types
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

  @ViewChild('categoryList') categoryList!: ElementRef;

  // Stato generale
  categories: any[] = [];
  selectedCategory: string = '';
  displayProducts: any[] = [];
  allProducts: any[] = [];
  canCreateContent = false;
  isLoading = false;
  SelectedProduct = false;
  selectedProducts: any[] = [];
  dataState!: SupermarketDataState;
  showCustomAlert = false;
  alertType: 'success' | 'error' = 'success';
  alertIcon: string = '';
  alertTitle: string = '';
  alertMessage: string = '';

  // Stato quantità
  quantities: { [barcode: string]: number } = {};
  availableQuantities: { [barcode: string]: number } = {};

  // Scroll
  private scrollListeners: Array<{ element: Element; listener: EventListener }> = [];

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private prodottiService: ProdottiService,
    private homeService: HomeService,
    private router: Router,
    private location: Location
  ) {
    addIcons({ add, remove, save });
  }

  // Lifecycle hooks
  ngOnInit() {
    this.checkPermissions();
    this.loadProducts();
    this.initializeQuantities();
  }

  ngAfterViewInit() {
    setTimeout(() => this.setupHorizontalScroll(), 500);
  }

  ngOnDestroy() {
    this.homeService.clearQuantityTimer();
    this.homeService.removeScrollListeners(this.scrollListeners);
  }

  // Gestione prodotti
  private initializeQuantities() {
    this.displayProducts.forEach(product => {
      if (!this.quantities[product.barcode]) {
        this.quantities[product.barcode] = 0;
      }
    });
  }

  private async loadProducts() {
    try {
      const selectedSupermarket = this.homeService.getSelectedSupermarket();
      if (!selectedSupermarket) {
        throw new Error('Nessun supermercato selezionato');
      }
      const allProducts = await this.prodottiService.loadDashboardProducts();
      const supermarketProducts = await this.prodottiService.loadSupermarketProductsWithoutImages(selectedSupermarket.id);
      const supermarketProductIds = new Set(supermarketProducts.map(p => p.id));
      this.allProducts = allProducts.filter(product => !supermarketProductIds.has(product.id));
      this.setupCategories();
      this.onCategorySelect('');
    } catch (error) {
      console.error('Error loading products:', error);
      this.allProducts = [];
      this.categories = [];
      this.displayProducts = [];
      this.showAlert('Errore nel caricamento dei prodotti', 'Errore');
    }
  }

  private setupCategories() {
    const categoryMap = new Map<string, { name: string, icon: string, count: number }>();
    this.allProducts.forEach(product => {
      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, {
          name: product.category,
          icon: this.prodottiService.getCategoryIcon(product.category),
          count: 1
        });
      } else {
        categoryMap.get(product.category)!.count++;
      }
    });
    this.categories = Array.from(categoryMap.values());
  }

  onCategorySelect(category: string) {
    this.selectedCategory = category;
    this.displayProducts = category 
      ? this.allProducts.filter(p => p.category === category)
      : this.allProducts;
    this.initializeQuantities();
  }

  // Prezzi
  getDisplayPrice(product: any): number {
    return product.offer_price ?? product.price ?? 0;
  }

  getOriginalPrice(product: any): number | null {
    return product.offer_price ? product.price : null;
  }

  // Clear product quantity
  clearProduct(barcode: string) {
    this.updateQuantity(barcode, -(this.quantities[barcode] || 0));
  }

  // Gestione quantità tramite servizio
  handleQuantityClick(barcode: string, amount: number, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.updateQuantity(barcode, amount);
  }

  incrementQuantity(barcode: string) { this.updateQuantity(barcode, 1); }
  decrementQuantity(barcode: string) { this.updateQuantity(barcode, -1); }
  
  onIncrementPress(barcode: string) { 
    this.homeService.startQuantityTimer(barcode, true, this.updateQuantity.bind(this));
  }
  
  onDecrementPress(barcode: string) { 
    this.homeService.startQuantityTimer(barcode, false, this.updateQuantity.bind(this));
  }
  
  onButtonRelease() { 
    this.homeService.clearQuantityTimer();
  }

  private updateQuantity(barcode: string, amount: number) {
    // Per la gestione prodotti, non applichiamo limiti rigidi di disponibilità
    // poiché i manager stanno aggiungendo prodotti al loro inventario
    const result = this.homeService.updateQuantity(this.quantities, barcode, amount);
    this.quantities = { ...result.quantities };
    this.updateSelectedProductStatus();
  }

  private updateSelectedProductStatus() {
    this.selectedProducts = this.allProducts.filter(p => (this.quantities[p.barcode] ?? 0) > 0);
    this.SelectedProduct = this.selectedProducts.length > 0;
  }

  // Navigazione
  goBack() {
    this.location.back();
  }

  onCreateProduct() {
    this.router.navigate(['/home/gestione/crea-prodotto']);
  }

  // UI
  private setupHorizontalScroll(): void {
    this.homeService.removeScrollListeners(this.scrollListeners);
    this.scrollListeners = [];
    
    const scrollableContainers = '.products-container, .categories-container';
    this.scrollListeners = this.homeService.setupHorizontalScroll(scrollableContainers);
  }

  handleImageError(event: any, category: string): void {
    const fallbackImage = (category?.toLowerCase() === 'tutti') 
      ? 'assets/categories/grocery-cart.png' 
      : 'assets/categories/packing.png';
    event.target.src = fallbackImage;
  }

  checkPermissions() {
  }

  addProductsToSupermarket() {
    console.log(this.selectedProducts);
  }

  private generateCategories() {
    const categories = this.homeService.generateCategories(this.allProducts);
    this.homeService.updateCategories(this.dataState, categories);
  }
}
