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
import { storefront, save, arrowBack, person, checkmarkCircle, closeCircle, close, location } from 'ionicons/icons';
import { HomeService, User } from '../../../services/home/home.service';
import { AuthService } from '../../../auth/auth.service';
import { debounceTime, Subject, takeUntil, map, take } from 'rxjs';

@Component({
  selector: 'app-crea-supermercato',
  templateUrl: './crea-supermercato.page.html',
  styleUrls: ['./crea-supermercato.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, IonButtons,
    IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonText, IonList,
    CommonModule, FormsModule
  ]
})
export class CreaSupermercatoPage implements OnInit, OnDestroy {
  public supermarket = {
    name: '',
    address: '',
    manager_id: null as number | null
  };
  
  // Component variables
  public isLoading = false;
  public isInitialized = false;
  public showCustomAlert = false;
  public alertMessage = '';
  public alertType: 'success' | 'error' = 'success';
  public alertTitle = '';
  public alertIcon = '';
  
  // Address variables
  public addressSuggestions: any[] = [];
  public isSearching = false;
  public selectedLat = '';
  public selectedLon = '';
  public isAddressSelected = false;
  public showAddressResults = false;
  
  // Manager variables (for admin users)
  public managers: User[] = [];
  public loadingManagers = false;
  public managerSearchText = '';
  public managerSuggestions: User[] = [];
  public selectedManager: User | null = null;
  public showManagerSuggestions = false;
  public showManagerResults = false;
  
  // User state tracking
  public readonly currentUser$ = this.homeService.currentUser$;
  public isAdmin = false;
  
  // Reactive streams
  private readonly addressInput$ = new Subject<string>();
  private readonly managerInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly homeService: HomeService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    addIcons({ 
      storefront, save, arrowBack, person, checkmarkCircle, 
      closeCircle, close, location,
    });
  }
  ngOnInit(): void {
    this.initializeComponent();
    this.setupAddressSearch();
    setTimeout(() => {
      if (this.isAdmin) {
        this.loadManagers();
      }
      this.isInitialized = true;
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isAdmin = user?.role === 'admin';
      if (!this.isAdmin) {
        if (!user) {
          this.router.navigate(['/home/dashboard']);
        }
      }
    });
  }

  // Setup address search with debounce
  private setupAddressSearch(): void {
    this.addressInput$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(address => this.fetchAddressSuggestions(address));

    this.managerInput$
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(query => this.filterManagersWithDebounce(query));
  }

  // Load managers for admin users
  private loadManagers(): void {
    if (!this.isAdmin) return;
    
    this.loadingManagers = true;
    this.homeService.supermarkets.getManagers()
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

  // Handle manager input
  onManagerInput(event: any): void {
    const query = event.detail.value;
    this.managerSearchText = query; 
    this.clearManagerSelection();
    this.managerInput$.next(query);
  }

  // Handle manager input focus
  onManagerFocus(): void {
    this.showManagerSuggestions = true;
    this.showManagerResults = true;
    if (this.managerSuggestions.length === 0 && this.managers.length > 0 && !this.managerSearchText) {
      this.managerSuggestions = this.managers;
    }
  }

  // Filter managers
  private filterManagersWithDebounce(query: string): void {
    if (!query) {
      this.clearManagerSuggestions();
      return;
    }

    this.showManagerResults = true;
    this.showManagerSuggestions = true;
    this.filterManagers(query);
  }

  // Select manager from suggestions
  selectManager(manager: User): void {
    this.selectedManager = manager;
    this.supermarket.manager_id = manager.id;
    this.managerSearchText = manager.username;
    this.clearManagerSuggestions();
  }

    
  // Getter for form validation
  get isSubmitDisabled$() {
    return this.currentUser$.pipe(
      map((user) => 
        this.isLoading || 
        (this.isInitialized && user?.role === 'admin' && !this.supermarket.manager_id) || 
        !this.isAddressSelected
      )
    );
  }

  // Filter managers
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

  // Reset manager search state
  private resetManagerSearch(): void {
    this.showManagerResults = false;
  }

  // Clear manager suggestions
  private clearManagerSuggestions(): void {
    this.managerSuggestions = [];
    this.showManagerSuggestions = false;
    this.showManagerResults = false;
  }

  // Clear manager selection
  private clearManagerSelection(): void {
    this.selectedManager = null;
    this.supermarket.manager_id = null;
  }

  // Hide manager suggestions
  hideManagerSuggestions(): void {
    this.clearManagerSuggestions();
  }

  // Handle address input with debounced search
  onAddressInput(event: any): void {
    const query = event.detail.value;
    this.supermarket.address = query;
    this.resetAddressSelection();
    this.addressInput$.next(query);
  }

  // Fetch address suggestions with debounce
  private async fetchAddressSuggestions(address: string): Promise<void> {
    if (!address || address.length < 3) {
      this.clearAddressSuggestions();
      return;
    }
    
    this.isSearching = true;
    this.showAddressResults = true;
    try {
      this.addressSuggestions = await this.homeService.position.fetchAddressSuggestions(address);
    } catch (error) {
      console.error('Errore ricerca indirizzi:', error);
      this.clearAddressSuggestions();
    } finally {
      this.isSearching = false;
    }
  }

  // Select address suggestion
  selectSuggestion(suggestion: any): void {
    this.supermarket.address = this.homeService.position.formatAddress(suggestion, this.supermarket.address);
    this.selectedLat = suggestion.lat;
    this.selectedLon = suggestion.lon;
    this.isAddressSelected = true;
    this.clearAddressSuggestions();
  }

  // Hide address suggestions
  hideSuggestions(): void {
    this.clearAddressSuggestions();
  }

  // Reset address selection state
  private resetAddressSelection(): void {
    this.selectedLat = '';
    this.selectedLon = '';
    this.isAddressSelected = false;
  }

  // Clear address suggestions
  private clearAddressSuggestions(): void {
    this.addressSuggestions = [];
    this.isSearching = false;
    this.showAddressResults = false;
  }

  // Create supermarket with validation
  async createSupermarket(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    await this.setManagerId();
    
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

  // Validate form fields
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

  // Set manager ID
  private async setManagerId(): Promise<void> {
    const user = await this.currentUser$.pipe(take(1)).toPromise();
    if (user?.role === 'manager' && !this.isAdmin) {
      this.supermarket.manager_id = user.id;
    }
  }

  // Submit supermarket data
  private async submitSupermarket(): Promise<any> {
    return await this.homeService.supermarkets.addSupermarket({
      name: this.supermarket.name,
      address: this.supermarket.address,
      latitude: this.selectedLat,
      longitude: this.selectedLon,
      manager_id: this.supermarket.manager_id?.toString()
    });
  }

  // Handle successful creation
  private handleSuccess(): void {
    this.showAlert('Supermercato creato con successo!', 'success');
    setTimeout(() => this.router.navigate(['/home/dashboard']), 2000);
  }

  // Handle creation error
  private handleError(error: any): void {
    console.error('Errore creazione supermercato:', error);
    const errorMessage = error?.error?.error || 'Errore durante la creazione del supermercato';
    this.showAlert(errorMessage, 'error');
  }

  // Reset form
  resetForm(): void {
    this.supermarket = { name: '', address: '', manager_id: null };
    this.resetAddressSelection();
    this.clearAddressSuggestions();
    this.clearManagerSelection();
    this.clearManagerSuggestions();
    this.managerSearchText = '';
  }

  // Show alert message
  private showAlert(message: string, type: 'success' | 'error'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.alertTitle = type === 'success' ? 'Operazione Completata' : 'Errore';
    this.alertIcon = type === 'success' ? 'checkmark-circle' : 'close-circle';
    this.showCustomAlert = true;
  }

  // Close alert dialog
  closeAlert(): void {
    this.showCustomAlert = false;
  }

  // Navigate back to dashboard
  goBack(): void {
    this.router.navigate(['/home/dashboard']);
  }

  // Handle form click to close suggestions
  onFormClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('ion-input') && !target.closest('.suggestions-container')) {
      this.clearAddressSuggestions();
      this.clearManagerSuggestions();
    }
  }

  // Track suggestions by coordinates
  trackByLatLon(index: number, suggestion: any): string {
    return `${suggestion.lat}-${suggestion.lon}`;
  }

  // Track items by ID
  trackById(index: number, item: any): number {
    return item.id;
  }
}
