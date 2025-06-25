import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HomeService, Product, Category } from '../../home.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-aggiungi-prodotto',
  templateUrl: './aggiungi-prodotto.page.html',
  styleUrls: ['./aggiungi-prodotto.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule
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
}
