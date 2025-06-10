import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonInput, IonButton, IonText } from '@ionic/angular/standalone';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonInput, IonButton, IonText,
            CommonModule, FormsModule,
          ]
})
export class LoginPage implements OnInit {
  username = '';
  password = '';
  errorMsg = '';

  constructor(
    private authService: AuthService, 
    private router: Router,
    private elementRef: ElementRef
  ) { }

  ngOnInit() {
  }

  private clearFocus() {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }
  onLogin() {
    this.errorMsg = '';

    if (!this.username || !this.password) {
      this.errorMsg = 'Inserisci username e password.';
      return;
    }
    if (this.authService.isLoggedIn()) {
      this.authService.logout();
    }
    
    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (res) => {
        this.authService.setUser(res.user);
        this.clearFocus();
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Errore di login';
      }
    });  }

  goToRegister() {
    this.clearFocus();
    this.router.navigate(['/register'], {
      state: {
        username: this.username,
        password: this.password
      }
    });
  }

}
