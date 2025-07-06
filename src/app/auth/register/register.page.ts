import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonItem, IonLabel, IonInput, IonButton, 
  IonText, IonRadioGroup, IonRadio, IonIcon
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
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonItem, IonLabel, IonInput, IonButton, 
    IonText, IonRadioGroup, IonRadio, IonIcon
  ]
})
export class RegisterPage implements OnInit {
  public username: string = '';
  public password: string = '';
  public email: string = '';
  public role: string = 'customer';
  public errorMsg: string = '';
  public successMsg: string = '';

  constructor(
    private readonly authService: AuthService, 
    private readonly router: Router,
    private readonly elementRef: ElementRef
  ) {
    this.initializeNavigationState();
  }

  ngOnInit(): void {}

  // Manage registration process
  onRegister(): void {
    this.resetMessages();

    if (!this.isFormValid()) {
      this.errorMsg = 'Tutti i campi sono obbligatori.';
      return;
    }

    if (!this.isUsernameValid()) {
      this.errorMsg = 'L\'username deve essere più lungo di 3 caratteri.';
      return;
    }

    if (!this.isPasswordValid()) {
      this.errorMsg = 'La password deve essere più lunga di 3 caratteri.';
      return;
    }
    
    if (!this.isPasswordSecure()) {
      this.errorMsg = 'La password deve contenere almeno un numero.';
      return;
    }

    if (!this.isEmailValid()) {
      this.errorMsg = 'Inserisci un indirizzo email valido.';
      return;
    }

    this.handleExistingSession();
    this.performRegistration();
  }

  // Navigate to login
  goToLogin(): void {
    this.clearFocus();
    this.router.navigate(['/login'], {
      state: {
        username: this.username,
        password: this.password
      }
    });
  }

  // Select user role
  selectRole(selectedRole: string): void {
    this.role = selectedRole;
  }

  // Initialize navigation state data
  private initializeNavigationState(): void {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.username = nav.extras.state['username'] || '';
      this.password = nav.extras.state['password'] || '';
    }
  }

  // Remove focus from active element
  private clearFocus(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }

  // Clear registration form
  private clearForm(): void {
    this.username = '';
    this.password = '';
    this.email = '';
    this.role = 'customer';
    this.errorMsg = '';
    this.successMsg = '';
  }

  // Reset error and success messages
  private resetMessages(): void {
    this.errorMsg = '';
    this.successMsg = '';
  }

  // Check if form is valid
  private isFormValid(): boolean {
    return !!(this.username && this.password && this.email && this.role);
  }

  // Validate username length
  private isUsernameValid(): boolean {
    return this.username.length > 3;
  }

  // Validate password length
  private isPasswordValid(): boolean {
    return this.password.length > 3;
  }

  // Check if password contains at least one number
  private isPasswordSecure(): boolean {
    return /\d/.test(this.password);
  }

  // Validate email format
  private isEmailValid(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email);
  }

  // Manage existing session
  private handleExistingSession(): void {
    if (this.authService.isLoggedIn()) {
      this.authService.logout();
    }
  }

  // Execute the registration
  private performRegistration(): void {
    const userData = { 
      username: this.username, 
      password: this.password, 
      email: this.email, 
      role: this.role 
    };

    this.authService.register(userData).subscribe({
      next: (response) => this.handleRegistrationSuccess(response),
      error: (error) => this.handleRegistrationError(error)
    });
  }

  // Handle registration success
  private handleRegistrationSuccess(response: any): void {
    this.successMsg = 'Registrazione avvenuta con successo!';
    this.clearForm();
    this.clearFocus();
    setTimeout(() => this.router.navigate(['/login']), 1000);
  }

  // Handle registration error
  private handleRegistrationError(error: any): void {
    if (error.status === 400 && error.error?.error?.includes('Username già presente')) {
      this.errorMsg = 'Username già registrato. Scegli un altro username.';
    } else {
      this.errorMsg = error.error?.error || 'Errore di registrazione';
    }
  }
}
