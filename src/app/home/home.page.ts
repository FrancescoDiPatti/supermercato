import { Component, OnInit, ElementRef } from '@angular/core';
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
  IonSplitPane
} from '@ionic/angular/standalone';
import { HomeService } from './home.service';
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
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
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
  ]
})
export class HomePage implements OnInit {  homeData: any;
  errorMsg = '';

  constructor(
    private homeService: HomeService,
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
      gridOutline,
    });
  }

  ngOnInit() {
    this.loadHome();
  }

  private clearFocus() {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }
  private loadHome() {
    this.homeData = null;
    this.errorMsg = '';
    this.authService.clearHomeData();

    this.homeService.getHome().subscribe({
      next: (res) => {
        this.homeData = res.data;
        if (res.data.user) {
          this.authService.setUser(res.data.user);
        }
      },
      error: (err) => {
        this.errorMsg = 'Errore nel recupero dei dati';
      }
    });
  }

  public get isAdmin(): boolean {
    const user = this.authService.getUser();
    return user && user.role === 'admin';
  }

  public get isManager(): boolean {
    const user = this.authService.getUser();
    return user && user.role === 'manager';
  }

  public get isCustomer(): boolean {
    const user = this.authService.getUser();
    return user && user.role === 'customer';
  }

  logout() {
    this.clearFocus();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
