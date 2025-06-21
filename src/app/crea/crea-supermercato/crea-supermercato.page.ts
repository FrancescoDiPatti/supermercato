import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
  IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText, IonList
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { storefront, save, arrowBack, person, checkmarkCircle, closeCircle, close } from 'ionicons/icons';
import { HomeService, User } from '../../home/home.service';
import { AuthService } from '../../auth/auth.service';
import { debounceTime, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-crea-supermercato',
  templateUrl: './crea-supermercato.page.html',
  styleUrls: ['./crea-supermercato.page.scss'],
  standalone: true,   imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
    IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText, IonList,
    CommonModule, FormsModule
  ]
})
export class CreaSupermercatoPage implements OnInit, OnDestroy {
  supermarket = {
    name: '',
    address: '',
    manager_id: null as number | null
  };
  
  // UI state
  isLoading = false;
  isInitialized = false;
  showCustomAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' = 'success';
  alertTitle = '';
  alertIcon = '';
  
  // User data
  currentUser: any = null;
  isAdmin = false;
  isManager = false;
    // Address handling
  addressSuggestions: any[] = [];
  isSearching = false;
  selectedLat = '';
  selectedLon = '';
  isAddressSelected = false;
  showAddressResults = false;
  
  // Manager handling (for admin users)
  managers: User[] = [];
  loadingManagers = false;
  managerSearchText = '';
  managerSuggestions: User[] = [];
  selectedManager: User | null = null;
  showManagerSuggestions = false;
  
  // Reactive streams
  private readonly addressInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private homeService: HomeService,
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ storefront, save, arrowBack, person, checkmarkCircle, closeCircle, close });
  }
  ngOnInit() {
    this.initializeComponent();
    this.setupAddressSearch();
    setTimeout(() => {
      if (this.isAdmin) {
        this.loadManagers();
      }
      this.isInitialized = true;
    }, 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  // ===== INITIALIZATION =====
  private initializeComponent(): void {
    this.currentUser = this.authService.getUser();
    this.isAdmin = this.homeService.isUserAdmin();
    this.isManager = this.homeService.isUserManager();
    
    if (!this.currentUser || !this.homeService.isUserAdminOrManager()) {
      this.router.navigate(['/home/dashboard']);
    }
  }

  private setupAddressSearch(): void {
    this.addressInput$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(address => this.fetchAddressSuggestions(address));
  }

  // ===== MANAGER HANDLING =====
  private loadManagers(): void {
    if (!this.isAdmin) return;
    
    this.loadingManagers = true;
    this.homeService.getManagers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (managers: User[]) => {
          this.managers = managers;
          this.loadingManagers = false;
        },
        error: (error: any) => {
          console.error('Error loading managers:', error);
          this.loadingManagers = false;
          this.showAlert('Errore nel caricamento dei manager', 'error');
        }
      });
  }

  onManagerInput(event: any): void {
    const query = event.detail.value;
    this.managerSearchText = query; 
    this.clearManagerSelection();
    this.filterManagers(query);
  }

  onManagerFocus(): void {
    this.showManagerSuggestions = true;
    if (this.managerSuggestions.length === 0 && this.managers.length > 0) {
      this.managerSuggestions = this.managers;
    }
  }

  onManagerBlur(): void {
    setTimeout(() => this.showManagerSuggestions = false, 300);
  }

  selectManager(manager: User): void {
    this.selectedManager = manager;
    this.supermarket.manager_id = manager.id;
    this.managerSearchText = manager.username;
    this.clearManagerSuggestions();
  }

  private filterManagers(searchText: string): void {
    if (!searchText?.length) {
      this.managerSuggestions = this.managers;
      return;
    }
    
    const query = searchText.toLowerCase();
    this.managerSuggestions = this.managers.filter(manager =>
      manager.username.toLowerCase().includes(query) ||
      manager.email.toLowerCase().includes(query)
    );
  }

  private clearManagerSelection(): void {
    this.selectedManager = null;
    this.supermarket.manager_id = null;
  }

  private clearManagerSuggestions(): void {
    this.managerSuggestions = [];
    this.showManagerSuggestions = false;
  }

  // ===== ADDRESS HANDLING =====
  onAddressInput(event: any): void {
    const query = event.detail.value;
    this.supermarket.address = query;
    this.resetAddressSelection();
    this.addressInput$.next(query);
  }
  private async fetchAddressSuggestions(address: string): Promise<void> {
    if (!address || address.length < 3) {
      this.clearAddressSuggestions();
      return;
    }
    
    this.isSearching = true;
    this.showAddressResults = true;
    try {
      this.addressSuggestions = await this.homeService.fetchAddressSuggestions(address);
    } catch (error) {
      console.error('Errore ricerca indirizzi:', error);
      this.clearAddressSuggestions();
    } finally {
      this.isSearching = false;
    }
  }

  selectSuggestion(suggestion: any): void {
    this.supermarket.address = this.homeService.formatAddress(suggestion, this.supermarket.address);
    this.selectedLat = suggestion.lat;
    this.selectedLon = suggestion.lon;
    this.isAddressSelected = true;
    this.clearAddressSuggestions();
  }

  hideSuggestions(): void {
    this.clearAddressSuggestions();
  }

  private resetAddressSelection(): void {
    this.selectedLat = '';
    this.selectedLon = '';
    this.isAddressSelected = false;
  }
  private clearAddressSuggestions(): void {
    this.addressSuggestions = [];
    this.isSearching = false;
    this.showAddressResults = false;
  }

  // ===== FORM SUBMISSION =====
  async createSupermarket(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.setManagerId();
    
    this.isLoading = true;
    try {
      await this.submitSupermarket();
      this.handleSuccess();
    } catch (error: any) {
      this.handleError(error);
    } finally {
      this.isLoading = false;
    }
  }

  private validateForm(): boolean {
    const validations = [
      {
        condition: !this.supermarket.name || !this.supermarket.address,
        message: 'Nome e indirizzo sono obbligatori'
      },
      {
        condition: !this.isAddressSelected || !this.selectedLat || !this.selectedLon,
        message: 'Devi selezionare un indirizzo tra quelli suggeriti'
      },
      {
        condition: this.isAdmin && !this.supermarket.manager_id,
        message: 'Devi selezionare un manager per il supermercato'
      }
    ];

    for (const validation of validations) {
      if (validation.condition) {
        this.showAlert(validation.message, 'error');
        return false;
      }
    }
    
    return true;
  }

  private setManagerId(): void {
    if (this.isManager && !this.isAdmin) {
      this.supermarket.manager_id = this.currentUser.id;
    }
  }

  private async submitSupermarket(): Promise<any> {
    return await this.homeService.addSupermarket({
      name: this.supermarket.name,
      address: this.supermarket.address,
      latitude: this.selectedLat,
      longitude: this.selectedLon,
      manager_id: this.supermarket.manager_id?.toString()
    });
  }

  private handleSuccess(): void {
    this.showAlert('Supermercato creato con successo!', 'success');
    setTimeout(() => this.router.navigate(['/home/dashboard']), 2000);
  }

  private handleError(error: any): void {
    console.error('Errore creazione supermercato:', error);
    const errorMessage = error?.error?.error || 'Errore durante la creazione del supermercato';
    this.showAlert(errorMessage, 'error');
  }

  // ===== FORM UTILITIES =====
  resetForm(): void {
    this.supermarket = { name: '', address: '', manager_id: null };
    this.resetAddressSelection();
    this.clearAddressSuggestions();
    this.clearManagerSelection();
    this.clearManagerSuggestions();
    this.managerSearchText = '';
  }

  // ===== UI UTILITIES =====
  private showAlert(message: string, type: 'success' | 'error'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.alertTitle = type === 'success' ? 'Operazione Completata' : 'Errore';
    this.alertIcon = type === 'success' ? 'checkmark-circle' : 'close-circle';
    this.showCustomAlert = true;
  }

  closeAlert(): void {
    this.showCustomAlert = false;
  }

  goBack(): void {
    this.router.navigate(['/home/dashboard']);
  }

  onFormClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('ion-input') && !target.closest('.suggestions-container')) {
      this.clearAddressSuggestions();
      this.clearManagerSuggestions();
    }
  }

  // ===== TRACK BY FUNCTIONS =====
  trackByLatLon(index: number, suggestion: any): string {
    return `${suggestion.lat}-${suggestion.lon}`;
  }
  trackById(index: number, item: any): number {
    return item.id;
  }
}
