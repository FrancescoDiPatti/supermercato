import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../../auth/auth.service';
import { HomeService } from '../home.service';

@Component({
  selector: 'app-ordini',
  templateUrl: './ordini.page.html',
  styleUrls: ['./ordini.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class OrdiniPage implements OnInit {
  constructor(
    private authService: AuthService,
    private homeService: HomeService
  ) { }

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
    // Example usage of roles
    if (!this.isCustomer && !this.isManager && !this.isAdmin) {
      console.warn('User not authorized to view orders');
    }
  }

}
