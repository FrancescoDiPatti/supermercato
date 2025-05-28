import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { IonItem, IonLabel, IonInput, IonButton, IonText } from '@ionic/angular/standalone';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonItem, IonLabel, IonInput, IonButton, IonText]
})
export class LoginPage implements OnInit {
  username = '';
  password = '';
  errorMsg = '';

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {}

  onLogin() {
    this.errorMsg = '';
    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (res) => {
        this.authService.setUser(res.user); // Salva utente loggato
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Errore di login';
      }
    });
  }

  goToRegister() {
    this.router.navigate(['/register'], {
      state: {
        username: this.username,
        password: this.password
      }
    });
  }

}
