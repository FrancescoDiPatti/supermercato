import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonItem, IonLabel, IonInput,
  IonButton, IonText, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  storefront, person, lockClosed, logIn, personAdd,
  mail, people, cart, briefcase, shieldCheckmark
} from 'ionicons/icons';
import { AuthService } from '../auth.service';

addIcons({
  storefront, person, lockClosed, logIn, personAdd,
  mail, people, cart, briefcase, shieldCheckmark
});

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    IonContent, IonItem, IonLabel, IonInput,
    IonButton, IonText, IonIcon
  ]
})
export class LoginPage implements OnInit {
  public username: string = '';
  public password: string = '';
  public errorMsg: string = '';

  constructor(
    private readonly authService: AuthService, 
    private readonly router: Router,
    private readonly elementRef: ElementRef
  ) { }

  ngOnInit(): void {}

  // Manage login process
  onLogin(): void {
    this.resetErrorState();
    this.clearSessionData();

    if (!this.isFormValid()) {
      this.errorMsg = 'Inserisci username e password.';
      return;
    }

    this.handleExistingSession();
    this.performLogin();
  }

  // Navigate to registration
  goToRegister(): void {
    this.clearFocus();
    this.router.navigate(['/register'], {
      state: {
        username: this.username,
        password: this.password
      }
    });
  }

  // Remove focus from active element
  private clearFocus(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }

  // Clear login form
  private clearForm(): void {
    this.username = '';
    this.password = '';
    this.errorMsg = '';
  }

  // Reset error state
  private resetErrorState(): void {
    this.errorMsg = '';
  }

  // Clear session data
  private clearSessionData(): void {
    sessionStorage.removeItem('inventoryData');
    sessionStorage.removeItem('cartItems');
  }

  // Check if form is valid
  private isFormValid(): boolean {
    return !!(this.username && this.password);
  }

  // Manage existing session
  private handleExistingSession(): void {
    if (this.authService.isLoggedIn()) {
      this.authService.logout();
    }
  }

  // Execute the login
  private performLogin(): void {
    const credentials = { 
      username: this.username, 
      password: this.password 
    };

    this.authService.login(credentials).subscribe({
      next: (response) => this.handleLoginSuccess(response),
      error: (error) => this.handleLoginError(error)
    });
  }

  // Handle login success
  private handleLoginSuccess(response: any): void {
    this.authService.setUser(response.user);
    this.clearForm();
    this.clearFocus();
    this.router.navigate(['/home/dashboard']);
  }

  // Handle login error
  private handleLoginError(error: any): void {
    this.errorMsg = error.error?.error || 'Errore di login';
  }

}
