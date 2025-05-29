import { Component, OnInit } from '@angular/core';
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

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {}

  onLogin() {
    this.errorMsg = '';

    if (!this.username || !this.password) {
      this.errorMsg = 'Inserisci username e password.';
      return;
    }
    
    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (res) => {
        this.authService.setUser(res.user);
        const role = res.user?.role;
        if (role === 'admin') {
          this.router.navigate(['/admin']);
        } else if (role === 'manager') {
          this.router.navigate(['/manager']);
        } else {
          this.router.navigate(['/user']);
        }
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
