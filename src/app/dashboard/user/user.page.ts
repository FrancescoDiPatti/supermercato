import { Component, OnInit } from '@angular/core';
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
  IonMenuToggle,
  IonApp,
  IonSplitPane
} from '@ionic/angular/standalone';
import { DashboardService } from '../dashboard.service';
import { AuthService } from '../../auth/auth.service';
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
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
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
    IonMenuToggle,
    IonApp,
    IonSplitPane
  ]
})
export class UserPage implements OnInit {
  dashboardData: any;
  errorMsg = '';

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService,
    private router: Router
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
    this.dashboardService.getDashboard().subscribe({
      next: (res) => {
        this.dashboardData = res.data;
      },
      error: (err) => {
        this.errorMsg = 'Errore nel recupero della dashboard';
      }
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
