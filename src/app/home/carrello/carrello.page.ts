import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { UserService } from '../../services/user/user.service';

@Component({
  selector: 'app-carrello',
  templateUrl: './carrello.page.html',
  styleUrls: ['./carrello.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class CarrelloPage implements OnInit {
  constructor(private userService: UserService) { }  public get isAdmin(): boolean {
    return this.userService.isUserAdmin();
  }

  public get isManager(): boolean {
    return this.userService.isUserManager();
  }

  public get isCustomer(): boolean {
    const user = this.userService.getCurrentUser();
    return user?.role === 'customer';
  }

  ngOnInit() {
    if (this.isCustomer) {
      console.log('Customer-specific logic here');
    }
  }
}
