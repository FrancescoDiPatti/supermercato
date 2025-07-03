import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner
} from '@ionic/angular/standalone';
import { AuthService } from '../../auth/auth.service';
import { HomeService } from '../home.service';
import { CarrelloService } from '../../services/carrello/carrello.service';
import { ProdottiService } from '../../services/prodotti/prodotti.service';
import { UiService } from '../../services/ui/ui.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  receiptOutline,
  storefrontOutline,
  timeOutline,
  calendarOutline,
  cardOutline,
  refreshOutline,
  arrowBack,
  basketOutline
} from 'ionicons/icons';

interface PurchaseHistory {
  id: number;
  product_name: string;
  product_barcode: string;
  supermarket_name: string;
  quantity: number;
  total_price: number;
  price_per_unit: number;
  purchase_date: string;
  on_offer: boolean;
}

@Component({
  selector: 'app-ordini',
  templateUrl: './ordini.page.html',
  styleUrls: ['./ordini.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonButton,
    IonIcon,

    IonBadge,
    IonSpinner,
    CommonModule, 
    FormsModule
  ]
})
export class OrdiniPage implements OnInit, OnDestroy {
  orders: PurchaseHistory[] = [];
  filteredOrders: PurchaseHistory[] = [];
  groupedOrders: Array<{key: string, value: PurchaseHistory[], name: string, date: string, total: number}> = [];
  availableSupermarkets: string[] = [];
  isLoading = false;
  private ordersSubscription?: Subscription;

  // Filter properties
  selectedPeriod: 'today' | 'week' | 'month' | 'all' = 'all';
  selectedSupermarket: string = 'all';

  constructor(
    private authService: AuthService,
    private homeService: HomeService,
    private carrelloService: CarrelloService,
    private prodottiService: ProdottiService,
    private uiService: UiService,
    private router: Router
  ) {
    addIcons({ 
      receiptOutline,
      storefrontOutline,
      timeOutline,
      calendarOutline,
      cardOutline,
      refreshOutline,
      arrowBack,
      basketOutline
    });
  }

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

  ngOnInit() {
    if (!this.isCustomer && !this.isManager && !this.isAdmin) {
      console.warn('User not authorized to view orders');
      return;
    }
    this.loadOrders();
  }

  ngOnDestroy() {
    if (this.ordersSubscription) {
      this.ordersSubscription.unsubscribe();
    }
  }

  async loadOrders() {
    this.isLoading = true;
    try {
      const purchaseHistory = await this.prodottiService.loadPurchaseHistory(50);
      this.orders = purchaseHistory || [];
      this.extractAvailableSupermarkets();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading orders:', error);
      this.orders = [];
      this.filteredOrders = [];
      this.groupedOrders = [];
    } finally {
      this.isLoading = false;
    }
  }

  private extractAvailableSupermarkets(): void {
    const supermarkets = new Set(this.orders.map(order => order.supermarket_name));
    this.availableSupermarkets = Array.from(supermarkets).sort();
  }

  private applyFilters(): void {
    let filtered = [...this.orders];

    // Gestione diretta dei filtri temporali con correzione server (aggiungi 2 ore)
    if (this.selectedPeriod !== 'all') {
      const now = new Date();
      filtered = filtered.filter(order => {
        // Correggi la data del server aggiungendo 2 ore
        const serverDate = new Date(order.purchase_date);
        const correctedDate = new Date(serverDate.getTime() + (2 * 60 * 60 * 1000));
        
        switch (this.selectedPeriod) {
          case 'today':
            return correctedDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            return correctedDate >= weekAgo;
          case 'month':
            return correctedDate.getMonth() === now.getMonth() && 
                   correctedDate.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    }

    // Filter by supermarket
    if (this.selectedSupermarket !== 'all') {
      filtered = filtered.filter(order => order.supermarket_name === this.selectedSupermarket);
    }

    this.filteredOrders = filtered;
    this.updateGroupedOrders();
  }

  private updateGroupedOrders(): void {
    if (!this.filteredOrders || this.filteredOrders.length === 0) {
      this.groupedOrders = [];
      return;
    }
    
    const grouped: { [key: string]: PurchaseHistory[] } = {};
    this.filteredOrders.forEach(order => {
      if (order && order.purchase_date && order.supermarket_name) {
        // Usa UiService per correggere la data
        const adjustedDate = this.uiService.adjustServerDate(order.purchase_date);
        const date = adjustedDate.toDateString();
        const key = `${date}-${order.supermarket_name}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(order);
      }
    });
    
    // Convert to array format e ordina per data (più recenti prima)
    this.groupedOrders = Object.keys(grouped)
      .map(key => {
        const orders = grouped[key];
        const total = orders.reduce((sum, order) => sum + order.total_price, 0);
        return {
          key,
          value: orders,
          name: orders[0]?.supermarket_name || 'Supermercato sconosciuto',
          date: orders[0]?.purchase_date || '',
          total: total
        };
      })
      .sort((a, b) => {
        // Usa UiService per correggere le date nel sorting
        const dateA = this.uiService.adjustServerDate(a.date);
        const dateB = this.uiService.adjustServerDate(b.date);
        return dateB.getTime() - dateA.getTime();
      });
  }

  // Filter methods
  filterByPeriod(period: 'today' | 'week' | 'month' | 'all'): void {
    this.selectedPeriod = period;
    this.applyFilters();
  }

  filterBySupermarket(supermarket: string): void {
    this.selectedSupermarket = supermarket;
    this.applyFilters();
  }

  trackByGroup(index: number, group: any): any {
    return group.key;
  }

  trackByOrder(index: number, order: PurchaseHistory): any {
    return order.id;
  }

  getOrderDate(dateString: string): string {
    return this.uiService.formatServerDate(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getOrderDateShort(dateString: string): string {
    return this.uiService.formatServerDateShort(dateString);
  }

  continueShopping() {
    this.router.navigate(['/home/dashboard']);
  }

  getTotalOrdersCount(): number {
    return this.filteredOrders.length;
  }

  getTotalSpent(): number {
    return this.filteredOrders.reduce((sum, order) => sum + order.total_price, 0);
  }

  hasActiveFilters(): boolean {
    return this.selectedPeriod !== 'all' || this.selectedSupermarket !== 'all';
  }

  getFilterDescription(): string {
    const filters = [];
    
    if (this.selectedPeriod !== 'all') {
      switch (this.selectedPeriod) {
        case 'today':
          filters.push('Oggi');
          break;
        case 'week':
          filters.push('Questa settimana');
          break;
        case 'month':
          filters.push('Questo mese');
          break;
      }
    }
    
    if (this.selectedSupermarket !== 'all') {
      filters.push(this.selectedSupermarket);
    }
    
    return filters.join(' • ');
  }

}
