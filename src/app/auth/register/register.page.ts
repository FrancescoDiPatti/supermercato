import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonInput, IonButton, IonText, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonInput, IonButton, IonText, IonSelect, IonSelectOption,
            CommonModule, FormsModule,
          ]
})
export class RegisterPage implements OnInit {
  username = '';
  password = '';
  email = '';
  role = 'customer';
  errorMsg = '';
  successMsg = '';

  constructor(private authService: AuthService, private router: Router) {
    // Recupera dati dal login se presenti
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.username = nav.extras.state['username'] || '';
      this.password = nav.extras.state['password'] || '';
    }
  }

  ngOnInit() {}

  onRegister() {
    this.errorMsg = '';
    this.successMsg = '';

    if (!this.username || !this.password || !this.email || !this.role) {
      this.errorMsg = 'Tutti i campi sono obbligatori.';
      return;
    }
    
    this.authService.register({ username: this.username, password: this.password, email: this.email, role: this.role }).subscribe({
      next: (res) => {
        this.successMsg = 'Registrazione avvenuta con successo!';
        setTimeout(() => this.router.navigate(['/login']), 1000);
      },
      error: (err) => {
        if (err.status === 400 && err.error?.error?.includes('Username già presente')) {
          this.errorMsg = 'Username già registrato. Scegli un altro username.';
        }else {
          this.errorMsg = err.error?.error || 'Errore di registrazione';
        }
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login'], {
      state: {
        username: this.username,
        password: this.password
      }
    });
  }
}
