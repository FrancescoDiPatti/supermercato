import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonItem, 
  IonLabel, 
  IonInput, 
  IonButton, 
  IonText, 
  IonRadioGroup,
  IonRadio,
  IonIcon
} from '@ionic/angular/standalone';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  storefront,
  person,
  lockClosed,
  logIn,
  personAdd,
  mail,
  people,
  cart,
  briefcase,
  shieldCheckmark
} from 'ionicons/icons';

addIcons({
  storefront,
  person,
  lockClosed,
  logIn,
  personAdd,
  mail,
  people,
  cart,
  briefcase,
  shieldCheckmark
});

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent, 
    IonItem, 
    IonLabel, 
    IonInput, 
    IonButton, 
    IonText, 
    IonRadioGroup,
    IonRadio,
    IonIcon
  ]
})
export class RegisterPage implements OnInit {
  username = '';
  password = '';
  email = '';
  role = 'customer';
  errorMsg = '';
  successMsg = '';

  constructor(
    private authService: AuthService, 
    private router: Router,
    private elementRef: ElementRef
  ) {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.username = nav.extras.state['username'] || '';
      this.password = nav.extras.state['password'] || '';
    }
  }

  ngOnInit() {}

  private clearFocus() {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      activeElement.blur();
    }
  }
  onRegister() {
    this.errorMsg = '';
    this.successMsg = '';

    if (!this.username || !this.password || !this.email || !this.role) {
      this.errorMsg = 'Tutti i campi sono obbligatori.';
      return;
    }

    // Validazione username
    if (this.username.length <= 3) {
      this.errorMsg = 'L\'username deve essere più lungo di 3 caratteri.';
      return;
    }

    // Validazione password
    if (this.password.length <= 3) {
      this.errorMsg = 'La password deve essere più lunga di 3 caratteri.';
      return;
    }
    
    if (!/\d/.test(this.password)) {
      this.errorMsg = 'La password deve contenere almeno un numero.';
      return;
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMsg = 'Inserisci un indirizzo email valido.';
      return;
    }
    if (this.authService.isLoggedIn()) {
      this.authService.logout();
    }
      this.authService.register({ username: this.username, password: this.password, email: this.email, role: this.role }).subscribe({
      next: (res) => {
        this.successMsg = 'Registrazione avvenuta con successo!';
        this.clearForm();
        this.clearFocus();
        setTimeout(() => this.router.navigate(['/login']), 1000);
      },
      error: (err) => {
        if (err.status === 400 && err.error?.error?.includes('Username già presente')) {
          this.errorMsg = 'Username già registrato. Scegli un altro username.';
        } else {
          this.errorMsg = err.error?.error || 'Errore di registrazione';
        }      }
    });}

  private clearForm(): void {
    this.username = '';
    this.password = '';
    this.email = '';
    this.role = '';
    this.errorMsg = '';
    this.successMsg = '';
  }

  selectRole(selectedRole: string) {
    this.role = selectedRole;
  }
  
  goToLogin() {
    this.clearFocus();
    this.router.navigate(['/login'], {
      state: {
        username: this.username,
        password: this.password
      }
    });
  }
}
