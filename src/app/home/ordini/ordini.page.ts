import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonButton, IonIcon, IonBadge,
  IonSpinner
} from '@ionic/angular/standalone';
import { AuthService } from '../../auth/auth.service';
import { HomeService } from '../../services/home/home.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { 
  receiptOutline, storefrontOutline, timeOutline, calendarOutline,
  cardOutline, refreshOutline, arrowBack, basketOutline
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
    IonContent, IonButton,  IonIcon,
    IonBadge, IonSpinner,
    CommonModule, FormsModule
  ]
})
export class OrdiniPage implements OnInit, OnDestroy {
  orders: PurchaseHistory[] = [];
  filteredOrders: PurchaseHistory[] = [];
  groupedOrders: Array<{key: string, value: PurchaseHistory[], name: string, date: string, total: number}> = [];
  availableSupermarkets: string[] = [];
  isLoading = false;
  private ordersSubscription?: Subscription;

  // Filter variables
  selectedPeriod: 'today' | 'week' | 'month' | 'all' = 'all';
  selectedSupermarket: string = 'all';

  constructor(
    private readonly authService: AuthService,
    private readonly homeService: HomeService,
    private readonly router: Router
  ) {
    addIcons({ 
      receiptOutline, storefrontOutline, timeOutline, calendarOutline,
      cardOutline, refreshOutline, arrowBack, basketOutline
    });
  }

  ngOnInit(): void {
    this.ordersSubscription = this.homeService.currentUser$.subscribe(user => {
      if (!user || !this.isAuthorizedUser(user)) {
        console.warn('User not authorized to view orders');
        return;
      }
      this.loadOrders();
    });
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
  }

  private isAuthorizedUser(user: any): boolean {
    return user?.role === 'customer' || user?.role === 'manager' || user?.role === 'admin';
  }

  // Clean up subscriptions
  private cleanupSubscriptions(): void {
    if (this.ordersSubscription) {
      this.ordersSubscription.unsubscribe();
    }
  }

  // Load orders from service
  async loadOrders(): Promise<void> {
    this.isLoading = true;
    try {
      const purchaseHistory = await this.homeService.products.loadPurchaseHistory(50);
      this.orders = purchaseHistory || [];
      this.extractAvailableSupermarkets();
      this.applyFilters();
    } catch (error) {
      console.error('Error loading orders:', error);
      this.resetOrdersData();
    } finally {
      this.isLoading = false;
    }
  }

  // Reset orders data on error
  private resetOrdersData(): void {
    this.orders = [];
    this.filteredOrders = [];
    this.groupedOrders = [];
  }

  // Extract available supermarkets from orders
  private extractAvailableSupermarkets(): void {
    const supermarkets = new Set(this.orders.map(order => order.supermarket_name));
    this.availableSupermarkets = Array.from(supermarkets).sort();
  }

  // Apply filters to orders
  private applyFilters(): void {
    let filtered = [...this.orders];

    // Apply time period filter
    if (this.selectedPeriod !== 'all') {
      filtered = this.filterByTimePeriod(filtered);
    }

    // Apply supermarket filter
    if (this.selectedSupermarket !== 'all') {
      filtered = filtered.filter(order => order.supermarket_name === this.selectedSupermarket);
    }

    this.filteredOrders = filtered;
    this.updateGroupedOrders();
  }

  // Filter orders by time period
  private filterByTimePeriod(orders: PurchaseHistory[]): PurchaseHistory[] {
    const now = new Date();
    
    return orders.filter(order => {
      const correctedDate = this.homeService.ui.adjustServerDate(order.purchase_date);
      
      switch (this.selectedPeriod) {
        case 'today':
          return correctedDate.toDateString() === now.toDateString();
        case 'week':
          return this.isDateInCurrentWeek(correctedDate, now);
        case 'month':
          return this.isDateInCurrentMonth(correctedDate, now);
        default:
          return true;
      }
    });
  }

  // Check if date is in current week
  private isDateInCurrentWeek(date: Date, now: Date): boolean {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - diffToMonday);
    lastMonday.setHours(0, 0, 0, 0);
    return date >= lastMonday && date <= now;
  }

  // Check if date is in current month
  private isDateInCurrentMonth(date: Date, now: Date): boolean {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    return date >= firstDay && date <= now;
  }

  // Update grouped orders display
  private updateGroupedOrders(): void {
    if (!this.filteredOrders || this.filteredOrders.length === 0) {
      this.groupedOrders = [];
      return;
    }
    
    const grouped = this.groupOrdersByDateAndSupermarket();
    this.groupedOrders = this.convertToSortedArray(grouped);
  }

  // Group orders by date and supermarket
  private groupOrdersByDateAndSupermarket(): { [key: string]: PurchaseHistory[] } {
    const grouped: { [key: string]: PurchaseHistory[] } = {};
    
    this.filteredOrders.forEach(order => {
      if (order && order.purchase_date && order.supermarket_name) {
        const adjustedDate = this.homeService.ui.adjustServerDate(order.purchase_date);
        const date = adjustedDate.toDateString();
        const key = `${date}-${order.supermarket_name}`;
        
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(order);
      }
    });
    
    return grouped;
  }

  // Convert grouped orders to sorted array
  private convertToSortedArray(grouped: { [key: string]: PurchaseHistory[] }): Array<{key: string, value: PurchaseHistory[], name: string, date: string, total: number}> {
    return Object.keys(grouped)
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
        const dateA = this.homeService.ui.adjustServerDate(a.date);
        const dateB = this.homeService.ui.adjustServerDate(b.date);
        return dateB.getTime() - dateA.getTime();
      });
  }

  // Get formatted order date
  getOrderDate(dateString: string): string {
    return this.formatDate(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get short formatted order date
  getOrderDateShort(dateString: string): string {
    return this.formatDate(dateString);
  }

  // Format date with options
  private formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
    const adjustedDate = this.homeService.ui.adjustServerDate(dateString);
    const defaultOptions: Intl.DateTimeFormatOptions = options || {};
    return adjustedDate.toLocaleDateString('it-IT', defaultOptions);
  }

  // Navigate to dashboard
  continueShopping(): void {
    this.router.navigate(['/home/dashboard']);
  }

  // Get total count of filtered orders
  getTotalOrdersCount(): number {
    return this.filteredOrders.length;
  }

  // Calculate total amount spent
  getTotalSpent(): number {
    return this.filteredOrders.reduce((sum, order) => sum + order.total_price, 0);
  }

  // Check if any filters are active
  hasActiveFilters(): boolean {
    return this.selectedPeriod !== 'all' || this.selectedSupermarket !== 'all';
  }

  // Get description of active filters
  getFilterDescription(): string {
    const filters = this.buildFilterDescriptions();
    return filters.join(' • ');
  }

  // Build filter descriptions array
  private buildFilterDescriptions(): string[] {
    const filters = [];
    
    if (this.selectedPeriod !== 'all') {
      filters.push(this.getPeriodDescription());
    }
    
    if (this.selectedSupermarket !== 'all') {
      filters.push(this.selectedSupermarket);
    }
    
    return filters;
  }

  // Get period description
  private getPeriodDescription(): string {
    const periodMap: Record<string, string> = {
      'today': 'Oggi',
      'week': 'Questa settimana',
      'month': 'Questo mese'
    };
    return periodMap[this.selectedPeriod] || '';
  }

  // Apply period filter
  filterByPeriod(period: 'today' | 'week' | 'month' | 'all'): void {
    this.selectedPeriod = period;
    this.applyFilters();
  }

  // Apply supermarket filter
  filterBySupermarket(supermarket: string): void {
    this.selectedSupermarket = supermarket;
    this.applyFilters();
  }

  // Track by function for group
  trackByGroup(index: number, group: any): any {
    return group.key;
  }

  // Track by function for order
  trackByOrder(index: number, order: PurchaseHistory): any {
    return order.id;
  }

}
