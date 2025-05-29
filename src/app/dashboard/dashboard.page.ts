import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonList,
  IonButton,
  IonText,
  IonMenu,
  IonMenuButton,
  IonButtons,
  IonIcon,
  IonSplitPane
} from '@ionic/angular/standalone';
import { DashboardService } from './dashboard.service';
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
} from 'ionicons/icons';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonItem,
    IonLabel,
    IonList,
    IonButton,
    IonText,
    IonMenu,
    IonMenuButton,
    IonButtons,
    IonIcon,
    IonSplitPane
  ]
})
export class DashboardPage implements OnInit {
  dashboardData: any;
  errorMsg = '';
  userRole: string = '';

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef
  ) {
    addIcons({ 
      storefrontOutline, 
      cubeOutline, 
      cartOutline, 
      receiptOutline,
      logOutOutline,
      menuOutline,
      pricetagsOutline,
    });
  }

  ngOnInit() {
    this.loadDashboard();
  }

  private clearFocus() {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }

  private loadDashboard() {
    // Clear existing dashboard data
    this.dashboardData = null;
    this.userRole = '';
    this.errorMsg = '';
    this.authService.clearDashboardData();

    this.dashboardService.getDashboard().subscribe({
      next: (res) => {
        this.dashboardData = res.data;
        this.userRole = this.dashboardData.user?.role || '';
      },
      error: (err) => {
        this.errorMsg = 'Errore nel recupero della dashboard';
      }
    });
  }

  isAdmin(): boolean {
    return this.userRole === 'admin';
  }

  isManager(): boolean {
    return this.userRole === 'manager';
  }

  isCustomer(): boolean {
    return this.userRole === 'customer';
  }

  canManageProducts(): boolean {
    return this.isAdmin() || this.isManager();
  }

  canManageOffers(): boolean {
    return this.isAdmin() || this.isManager();
  }

  canManageSupemarkets(): boolean {
    return this.isAdmin();
  }

  logout() {
    this.clearFocus();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
