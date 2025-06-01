import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-ordini',
  templateUrl: './ordini.page.html',
  styleUrls: ['./ordini.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class OrdiniPage implements OnInit {
  constructor(private authService: AuthService) { }

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

  ngOnInit() {
    // Example usage of roles
    if (!this.isCustomer && !this.isManager && !this.isAdmin) {
      console.warn('User not authorized to view orders');
    }
  }

}
