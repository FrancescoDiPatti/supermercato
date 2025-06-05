import { Component, OnInit, AfterViewInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  navigateOutline, 
  storefrontOutline, 
  warningOutline, 
  addCircleOutline, 
  closeOutline, 
  saveOutline,
  locationOutline,
  pinOutline
} from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { HomeService, Supermarket } from '../home.service';
import * as L from 'leaflet';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { AuthService } from '../../auth/auth.service';
import { debounceTime, Subject } from 'rxjs';

const iconRetinaUrl = 'assets/markers/marker-icon.png';
const iconUrl = 'assets/markers/marker-icon.png';
const shadowUrl = 'assets/markers/marker-shadow.png';

L.Marker.prototype.options.icon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.mergeOptions({
  interactive: true,
  bubblingMouseEvents: false
});

declare global {
  interface Window { Swiper: any; }
}

@Component({
  selector: 'app-supermercati',
  templateUrl: './supermercati.page.html',
  styleUrls: ['./supermercati.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SupermercatiPage implements OnInit, AfterViewInit, OnDestroy {
  // Map related properties
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private userMarker: L.CircleMarker | undefined;
  private mapInitialized = false;

  // Location properties
  public userPosition: L.LatLng | null = null;
  private watchId: string | null = null;
  locationError: string | null = null;

  // Data properties
  supermarkets: Supermarket[] = [];
  selectedSupermarket: Supermarket | null = null;
  private selectedSupermarketFromSearch: Supermarket | null = null;
  isLoading = true;

  // Responsive properties
  isSmallDevice = false;
  private resizeListener?: () => void;

  // Modal properties
  addSupermarketModalOpen = false;
  newSupermarket = { name: '', address: '', manager_id: '' };
  addressSuggestions: any[] = [];
  isSubmitting = false;
  private addressInput$ = new Subject<string>();
  private selectedLat: string = '';
  private selectedLon: string = '';

  // Supermarket images mapping
  private readonly supermarketImages: { [key: string]: string } = {
    lidl: 'assets/supermercati/lidl.webp',
    conad: 'assets/supermercati/conad.webp',
    crai: 'assets/supermercati/crai.webp',
    md: 'assets/supermercati/md.webp',
    esselunga: 'assets/supermercati/esselunga.webp',
    coop: 'assets/supermercati/coop.webp',
    eurospin: 'assets/supermercati/eurospin.webp',
    carrefour: 'assets/supermercati/carrefour.webp',
    pam: 'assets/supermercati/pam.webp',
    sigma: 'assets/supermercati/sigma.webp',
    "in's": 'assets/supermercati/ins.webp',
    famila: 'assets/supermercati/famila.webp',
    sisa: 'assets/supermercati/sisa.webp',
  };
  constructor(
    private supermarketsService: HomeService,
    private router: Router,
    private platform: Platform,
    private authService: AuthService
  ) {
    addIcons({ 
      navigateOutline, 
      warningOutline, 
      storefrontOutline, 
      addCircleOutline, 
      closeOutline, 
      saveOutline,
      locationOutline,
      pinOutline
    });
    this.checkScreenSize();
    this.setupResizeListener();
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initializeMap(), 100);
    this.initializeSwiper();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
  // ===INITIALIZATION===
  private initializeComponent(): void {
    this.checkScreenSize();
    this.loadSupermarkets();
    this.requestLocationPermissionAndStartUpdates();
    this.setupAddressDebouncing();
    this.setupUniversalSearchListeners();
    this.setupResizeListener();
  }

  private setupAddressDebouncing(): void {
    this.addressInput$.pipe(debounceTime(400)).subscribe(address => {
      this.fetchAddressSuggestions(address);
    });
  }

  private cleanup(): void {
    this.stopLocationUpdates();
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    this.removeResizeListener();
  }

  private setupResizeListener(): void {
    this.resizeListener = () => {
      this.checkScreenSize();
      if (this.mapInitialized) {
        this.map!.invalidateSize();
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  private checkScreenSize(): void {
    this.isSmallDevice = window.innerWidth < 768;
  }

  private removeResizeListener(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = undefined;
    }
  }

  // ===SEARCH===
  private setupUniversalSearchListeners(): void {
    window.addEventListener('universalSearch', (event: any) => {
      if (event.detail.type === 'supermarkets') {
        this.handleUniversalSearch(event.detail.query);
      }
    });

    window.addEventListener('universalSearchSelect', (event: any) => {
      if (event.detail.type === 'supermarkets') {
        this.handleUniversalSearchSelect(event.detail.result);
      }
    });
  }

  private async handleUniversalSearch(query: string): Promise<void> {
    const results = await this.searchSupermarketsForUniversal(query);
    const event = new CustomEvent('universalSearchResults', {
      detail: { results, type: 'supermarkets' }
    });
    window.dispatchEvent(event);
  }

  private async searchSupermarketsForUniversal(query: string): Promise<any[]> {
    const lowerQuery = query.toLowerCase();
    const filtered = this.supermarkets.filter(sm => 
      sm.name.toLowerCase().includes(lowerQuery) || 
      sm.address.toLowerCase().includes(lowerQuery)
    );
    const sorted = filtered.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(lowerQuery);
      const bNameMatch = b.name.toLowerCase().includes(lowerQuery);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      if (this.userPosition) {
        const distA = this.calculateDistance(
          this.userPosition.lat, this.userPosition.lng,
          a.latitude, a.longitude
        );
        const distB = this.calculateDistance(
          this.userPosition.lat, this.userPosition.lng,
          b.latitude, b.longitude
        );
        return distA - distB;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted.slice(0, 8).map(sm => ({
      id: sm.id.toString(),
      label: sm.name,
      sublabel: `${sm.address}${this.getDistanceFromUser(sm.latitude, sm.longitude) ? 
        ' • ' + this.getDistanceFromUser(sm.latitude, sm.longitude) : ''}`,
      data: sm
    }));
  }

  private handleUniversalSearchSelect(result: any): void {
    if (result.type === 'recent' || !result.data) {
      const searchTerm = result.label.toLowerCase();
      const foundSupermarket = this.supermarkets.find(sm => 
        sm.name.toLowerCase().includes(searchTerm) || 
        sm.address.toLowerCase().includes(searchTerm)
      );
      if (foundSupermarket) {
        this.selectSupermarket(foundSupermarket);
        this.selectedSupermarketFromSearch = foundSupermarket;
      }
      return;
    }
    const supermarket = result.data as Supermarket;
    this.selectSupermarket(supermarket);
    this.selectedSupermarketFromSearch = supermarket;
  }

  // === GEOLOCATION ===
  private async requestLocationPermissionAndStartUpdates(): Promise<void> {
    try {
      if (this.platform.is('hybrid')) {
        const permissionStatus = await Geolocation.checkPermissions();
        if (permissionStatus.location !== 'granted') {
          const permission = await Geolocation.requestPermissions();
          if (permission.location !== 'granted') {
            throw new Error('Permission not granted');
          }
        }
      }
      await this.startLocationUpdates();
    } catch (error: any) {
      console.error('Error requesting location permission:', error);
      this.isLoading = false;
    }
  }

  private async startLocationUpdates(): Promise<void> {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      this.handlePositionUpdate({ 
        coords: { 
          latitude: position.coords.latitude, 
          longitude: position.coords.longitude 
        } 
      });

      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true }, 
        (pos, err) => {
          if (pos) {
            this.handlePositionUpdate({ 
              coords: { 
                latitude: pos.coords.latitude, 
                longitude: pos.coords.longitude 
              } 
            });
          } else if (err) {
            console.error('Error watching position:', err);
          }
        }
      );
    } catch (error) {
      console.error('Error starting location updates:', error);
    }
  }

  private stopLocationUpdates(): void {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    if (this.userMarker && this.map) {
      this.userMarker.remove();
      this.userMarker = undefined;
    }
  }

  private handlePositionUpdate(position: { coords: { latitude: number; longitude: number } }): void {
    if (position?.coords?.latitude && position?.coords?.longitude) {
      this.locationError = null;
      this.userPosition = L.latLng(position.coords.latitude, position.coords.longitude);
      if (this.map && this.mapInitialized) {
        this.updateUserMarker();
        this.map.setView(this.userPosition, 13);
      }
      if (this.supermarkets.length > 0) {
        this.sortSupermarketsByDistance();
      }
    }
  }

  private updateUserMarker(): void {
    if (!this.map || !this.userPosition) return;

    if (this.userMarker) {
      this.userMarker.setLatLng(this.userPosition);
    } else {
      this.userMarker = L.circleMarker(this.userPosition, {
        radius: 8,
        fillColor: '#4a89f3',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);
    }
  }

  // === DISTANCE CALCULATION ===
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private sortSupermarketsByDistance(): void {
    if (!this.userPosition) return;

    this.supermarkets.sort((a, b) => {
      const distA = this.calculateDistance(
        this.userPosition!.lat,
        this.userPosition!.lng,
        a.latitude,
        a.longitude
      );
      const distB = this.calculateDistance(
        this.userPosition!.lat,
        this.userPosition!.lng,
        b.latitude,
        b.longitude
      );
      return distA - distB;
    });
  }

  private formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  }

  getDistanceFromUser(latitude: number, longitude: number): string | null {
    if (!this.userPosition) return null;
    const distance = this.calculateDistance(
      this.userPosition.lat,
      this.userPosition.lng,
      latitude,
      longitude
    );
    return this.formatDistance(distance);
  }

  // === MAP METHODS ===  
  private initializeMap(): void {
    if (this.mapInitialized) return;
    
    try {      
      this.map = L.map('map', {
        center: [41.9028, 12.4964],
        zoom: 6,
        zoomControl: true,
        maxZoom: 20,
        minZoom: 3,
        keyboard: false
      });
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20
      }).addTo(this.map);
      this.map.on('click', (e) => {
        const target = (e as any).originalEvent?.target;
        if (target && target.classList.contains('leaflet-container')) {
          this.clearSelection();
        }
      });
      
      const mapContainer = this.map.getContainer();
      mapContainer.style.borderRadius = '16px';
      mapContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';      
      
      this.mapInitialized = true;

      if (this.userPosition) {
        this.updateUserMarker();
      }
      if (this.supermarkets.length > 0) {
        this.addMarkersToMap();
      }
    } catch (error) {
      console.error('Map initialization error:', error);
    }
  }

  private addMarkersToMap(): void {
    if (!this.map || !this.mapInitialized) return;
    
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
    const bounds = L.latLngBounds([]);
    const positionCounts = new Map<string, number>();

    this.supermarkets.forEach(supermarket => {
      const positionKey = `${supermarket.latitude},${supermarket.longitude}`;
      const count = positionCounts.get(positionKey) || 0;
      positionCounts.set(positionKey, count + 1);
      
      const offsetMultiplier = 0.00002; // about 2 meters
      const angle = (count * 60) * (Math.PI / 180); // 60 degrees separation
      const offsetLat = Math.sin(angle) * offsetMultiplier * count;
      const offsetLng = Math.cos(angle) * offsetMultiplier * count;
      
      const adjustedLat = supermarket.latitude + offsetLat;
      const adjustedLng = supermarket.longitude + offsetLng;      
      const marker = L.marker([adjustedLat, adjustedLng])
        .addTo(this.map!);

      marker.bindPopup(`
        <strong>${supermarket.name}</strong><br>
        ${supermarket.address}<br>
      `);      
      marker.on('click', (e) => {
        console.log('Marker clicked:', supermarket.name);
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
        this.markers.forEach(m => {
          if (m !== marker) {
            m.closePopup();
          }
        });
        this.selectSupermarket(supermarket, true);
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
      });
      
      (marker as any).supermarketId = supermarket.id;
      this.markers.push(marker);
      bounds.extend([adjustedLat, adjustedLng]);
    });

    if (bounds.getNorth() !== bounds.getSouth() && bounds.getEast() !== bounds.getWest()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }    
  selectSupermarket(supermarket: Supermarket, fromMarkerClick: boolean = false): void {
    this.selectedSupermarket = supermarket;
    if (!this.map || !this.mapInitialized) return;
    if (!fromMarkerClick) {
      this.markers.forEach(m => m.closePopup());
    }
    
    const marker = this.markers.find(m => (m as any).supermarketId === supermarket.id);
    if (marker) {
      const markerLatLng = marker.getLatLng();
      this.map.setView([markerLatLng.lat, markerLatLng.lng], 15, {
        animate: true,
        duration: 1
      });      if (!fromMarkerClick) {
        setTimeout(() => {
          marker.openPopup();
        }, 1200);
      }
    } else {
      this.map.setView([supermarket.latitude, supermarket.longitude], 15, {
        animate: true,
        duration: 1
      });
    }
    
    setTimeout(() => this.map?.invalidateSize(), 200);
    setTimeout(() => this.scrollToSupermarketCard(supermarket), 300);
  }

  private clearSelection(): void {
    this.selectedSupermarket = null;
    this.selectedSupermarketFromSearch = null;
    if (this.markers && this.markers.length > 0) {
      this.markers.forEach(marker => marker.closePopup());
    }
  }

  // === SWIPER ===
  private initializeSwiper(): void {
    if (!customElements.get('swiper-container')) {
      import('swiper/element/bundle').then((module) => {
        module.register();
        setTimeout(() => this.setupSwiperEvents(), 200);
      });
    } else {
      setTimeout(() => this.setupSwiperEvents(), 200);
    }
  }

  private setupSwiperEvents(): void {
    const swiperContainer = document.querySelector('.supermarket-cards-swiper') as any;
    if (!swiperContainer) return;
    
    const checkSwiper = setInterval(() => {
      if (swiperContainer.swiper) {
        clearInterval(checkSwiper);
        const swiper = swiperContainer.swiper;
        
        swiper.on('slideChangeTransitionStart', () => {
          swiperContainer.classList.add('swiper-transitioning');
        });
        
        swiper.on('slideChangeTransitionEnd', () => {
          swiperContainer.classList.remove('swiper-transitioning');
        });
        
        swiper.on('transitionStart', () => {
          swiperContainer.setAttribute('data-swiper-transitioning', 'true');
        });
        
        swiper.on('transitionEnd', () => {
          swiperContainer.removeAttribute('data-swiper-transitioning');
        });
      }
    }, 100);
    
    setTimeout(() => clearInterval(checkSwiper), 5000);
  }

  private scrollToSupermarketCard(supermarket: Supermarket): void {
    const itemElement = document.querySelector(`[data-supermarket-id="${supermarket.id}"]`) as HTMLElement;
    if (!itemElement) return;
    
    const swiperContainer = document.querySelector('.supermarket-cards-swiper') as any;
    if (!swiperContainer) {
      this.fallbackScrollToElement(itemElement);
      return;
    }
    
    const waitForSwiper = (attempt = 0) => {
      if (attempt > 50) {
        this.fallbackScrollToElement(itemElement);
        return;
      }
      
      if (!swiperContainer.swiper) {
        setTimeout(() => waitForSwiper(attempt + 1), 100);
        return;
      }
      
      const swiper = swiperContainer.swiper;
      const slideElement = itemElement.closest('swiper-slide') as HTMLElement;
      if (!slideElement) {
        this.fallbackScrollToElement(itemElement);
        return;
      }
      
      const slides = Array.from(swiperContainer.querySelectorAll('swiper-slide'));
      const slideIndex = slides.indexOf(slideElement);
      if (slideIndex === -1) {
        this.fallbackScrollToElement(itemElement);
        return;
      }
      
      try {
        if (swiper.slideToLoop && typeof swiper.slideToLoop === 'function') {
          swiper.slideToLoop(slideIndex, 500);
          setTimeout(() => {
            if (swiper.update) swiper.update();
            if (swiper.updateSlides) swiper.updateSlides();
          }, 600);
        }
      } catch (error) {
        this.fallbackScrollToElement(itemElement);
      }
    };
    
    waitForSwiper();
  }

  private fallbackScrollToElement(itemElement: HTMLElement): void {
    try {
      itemElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
    } catch (error) {}
  }

  // === NAVIGATION ===
  openInMaps(supermarket: Supermarket, event: Event): void {
    event.stopPropagation();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${supermarket.latitude},${supermarket.longitude}`;
    window.open(url, '_blank');
  }

  selectAndNavigate(supermarket: Supermarket, event: Event): void {
    event.stopPropagation();
    this.selectedSupermarket = supermarket;
    this.supermarketsService.setSelectedSupermarket(supermarket);
    this.router.navigate(['/home/dashboard']);
  }

  // === ADD SUPERMARKET ===
  openAddSupermarketModal(): void {
    this.resetModalForm();
    setTimeout(() => {
      this.addSupermarketModalOpen = true;
    }, 100);
  }

  closeAddSupermarketModal(): void {
    this.addSupermarketModalOpen = false;
    this.addressSuggestions = [];
  }

  private resetModalForm(): void {
    this.newSupermarket = { name: '', address: '', manager_id: '' };
    this.addressSuggestions = [];
    this.selectedLat = '';
    this.selectedLon = '';
    this.isSubmitting = false;
  }

  onAddressInputDebounced(): void {
    this.addressInput$.next(this.newSupermarket.address);
    this.selectedLat = '';
    this.selectedLon = '';
  }

  async fetchAddressSuggestions(address: string): Promise<void> {
    if (!address || address.length < 3) {
      this.addressSuggestions = [];
      return;
    }
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1&limit=5`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      this.addressSuggestions = data;
    } catch (e) {
      this.addressSuggestions = [];
    }
  }

  selectAddressSuggestion(suggestion: any): void {
    let formatted = '';
    const address = suggestion.address || {};
    const isItaly = address.country_code && address.country_code.toUpperCase() === 'IT';
    
    if (!isItaly && address.country_code) {
      formatted += `(${address.country_code.toUpperCase()}) `;
    }
    
    if (address.road) {
      formatted += address.road;
    }
    
    let houseNumber = address.house_number;
    if (!houseNumber) {
      const input = this.newSupermarket.address;
      const match = input.match(/\b(\d{1,5}[a-zA-Z]?)\b(?!.*\b\d{1,5}[a-zA-Z]?\b)/);
      if (match) {
        houseNumber = match[1];
      }
    }
    
    if (houseNumber) {
      formatted += ', ' + houseNumber;
    }
    
    let prov = '';
    if (address.county) {
      prov = address.county.substring(0,2).toUpperCase();
    } else if (address.state_code) {
      prov = address.state_code.substring(0,2).toUpperCase();
    } else if (address.state) {
      prov = address.state.substring(0,2).toUpperCase();
    } else if (address.display_name) {
      const match = address.display_name.match(/\((\w{2})\)/);
      if (match) prov = match[1].toUpperCase();
    }
    
    if (prov) {
      formatted += ` (${prov})`;
    }
    
    this.newSupermarket.address = formatted.trim();
    this.selectedLat = suggestion.lat;
    this.selectedLon = suggestion.lon;
    this.addressSuggestions = [];
  }

  async submitAddSupermarket(): Promise<void> {
    if (!this.newSupermarket.name || !this.newSupermarket.address || !this.selectedLat || !this.selectedLon) {
      console.log('Missing required fields');
      return;
    }
    
    if (this.isManager && !this.isAdmin) {
      const currentUser = this.authService.getUser();
      this.newSupermarket.manager_id = currentUser.id;
    }
    
    this.isSubmitting = true;
    try {
      await this.supermarketsService.addSupermarket({
        name: this.newSupermarket.name,
        address: this.newSupermarket.address,
        latitude: this.selectedLat,
        longitude: this.selectedLon,
        manager_id: this.newSupermarket.manager_id
      });
      this.closeAddSupermarketModal();
      this.loadSupermarkets();
    } finally {
      this.isSubmitting = false;
    }
  }

  // === LOADING SUPERMARKETS ===
  private loadSupermarkets(): void {
    this.isLoading = true;
    this.supermarketsService.getSupermarkets().subscribe({
      next: (response: { supermarkets: Supermarket[] }) => {
        if (this.isManager) {
          const currentUser = this.authService.getUser();
          this.supermarkets = response.supermarkets.filter(sm => sm.manager_id === currentUser.id);
        } else {
          this.supermarkets = response.supermarkets;
        }
        
        if (this.userPosition) {        this.sortSupermarketsByDistance();
        }
        if (this.mapInitialized) {
          this.addMarkersToMap();
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading supermarkets:', error);
        this.isLoading = false;
      }
    });
  }

  // === IMAGE UTILITY ===
  private getClosestSupermarketKey(name: string): string | null {
    const normalized = name.trim().toLowerCase();
    let minDistance = Infinity;
    let closestKey: string | null = null;
    
    for (const key of Object.keys(this.supermarketImages)) {
      const dist = this.levenshtein(normalized, key);
      if (dist < minDistance) {
        minDistance = dist;
        closestKey = key;
      }
    }
    
    return minDistance <= 4 ? closestKey : null;
  }

  private levenshtein(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
        }
      }
    }
    
    return matrix[a.length][b.length];
  }

  getStoreImage(name: string): string {
    const key = this.getClosestSupermarketKey(name);
    return key ? this.supermarketImages[key] : 'assets/supermercati/def_sm.webp';
  }

  // === ROLE CHECK ===
  public get isAdminOrManager(): boolean {
    const user = this.authService.getUser();
    return user && (user.role === 'admin' || user.role === 'manager');
  }

  public get isAdmin(): boolean {
    const user = this.authService.getUser();
    return user && user.role === 'admin';
  }

  public get isManager(): boolean {
    const user = this.authService.getUser();
    return user && user.role === 'manager';
  }
}
