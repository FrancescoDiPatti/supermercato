import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HomeService, Product, Category } from '../../home.service';
import { AuthService } from '../../../auth/auth.service';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
  IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText,
  IonList, IonRadioGroup, IonRadio, IonImg,
  IonThumbnail, IonSearchbar, IonNote
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-aggiungi-prodotto',
  templateUrl: './aggiungi-prodotto.page.html',
  styleUrls: ['./aggiungi-prodotto.page.scss'],
  standalone: true,
  imports: [
    IonHeader, IonTitle, IonToolbar, IonButtons, 
    IonButton, IonIcon, CommonModule, FormsModule
  ]
})
export class AggiungiProdottoPage implements OnInit {

  product = {
    name: '',
    description: '',
    category: '',
    price: 0,
    quantity: 1,
    barcode: ''
  };

  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
  }

  // ===== NAVIGATION =====
  goBack(): void {
    this.router.navigate(['/home/dashboard']);
  }
}
