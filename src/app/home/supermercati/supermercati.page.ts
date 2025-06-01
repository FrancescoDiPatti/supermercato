import { Component, OnInit, AfterViewInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { navigateOutline, storefrontOutline, warningOutline, addCircleOutline, closeOutline, saveOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { SupermercatiService, Supermarket } from './supermercati.service';
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
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private userMarker: L.CircleMarker | undefined;
  public userPosition: L.LatLng | null = null;
  private watchId: string | null = null;
  locationError: string | null = null;
  supermarkets: Supermarket[] = [];
  selectedSupermarket: Supermarket | null = null;
  isLoading = true;
  private mapInitialized = false;

  addSupermarketModalOpen = false;
  newSupermarket = { name: '', address: '' };
  addressSuggestions: any[] = [];
  isSubmitting = false;
  private addressInput$ = new Subject<string>();
  private selectedLat: string = '';
  private selectedLon: string = '';

  constructor(
    private supermarketsService: SupermercatiService,
    private router: Router,
    private platform: Platform,
    private authService: AuthService
  ) 
  {
    addIcons({ navigateOutline, warningOutline, storefrontOutline, addCircleOutline, closeOutline, saveOutline });
  }
  ngOnInit(): void {
    this.loadSupermarkets();
    this.requestLocationPermissionAndStartUpdates();
    this.addressInput$.pipe(debounceTime(400)).subscribe(address => {
      this.fetchAddressSuggestions(address);
    });
  }

//GEOLOCATION
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
        await this.startLocationUpdates();
      } else {
        await this.startLocationUpdates();
      }
    } catch (error: any) {
      console.error('Error requesting location permission:', error);
      this.isLoading = false;
    }
  }
  private async getCurrentPosition(): Promise<void> {
    try {
      const permissionStatus = await Geolocation.checkPermissions();
      if (permissionStatus.location !== 'granted') {
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== 'granted') {
          throw new Error('Err Location');
        }
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      this.userPosition = L.latLng(position.coords.latitude, position.coords.longitude);
      if (this.map && this.mapInitialized) {
        this.updateUserMarker();
        this.map.setView(this.userPosition, 13);
      }
      if (this.supermarkets.length > 0) {
        this.sortSupermarketsByDistance();
      }
    } catch (error) {
      console.error('Err Location:', error);
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

  //GEO UPDATE
  private async startLocationUpdates(): Promise<void> {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      this.handlePositionUpdate({ coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } });

      this.watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
        if (pos) {
          this.handlePositionUpdate({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } });
        } else if (err) {
          console.error('Error watching position:', err);
        }
      });
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
  }  private handlePositionUpdate(position: { coords: { latitude: number; longitude: number } }): void {
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

  //GEO DISTANCE
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


//MAP
  ngOnDestroy(): void {
    this.stopLocationUpdates();
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }
  private initializeMap(): void {
    if (this.mapInitialized) {
      return;
    }
    try {
      this.map = L.map('map', {
        center: [41.9028, 12.4964],
        zoom: 6,
        zoomControl: true,
        maxZoom: 18,
        minZoom: 3
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);
      const mapContainer = this.map.getContainer();
      mapContainer.style.borderRadius = '16px';
      mapContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';      this.mapInitialized = true;

      if (this.userPosition) {
        this.updateUserMarker();
      }
      if (this.supermarkets.length > 0) {
        this.addMarkersToMap();
      }
    } catch (error) {
      console.error('Errore mappa:', error);
    }
  }

//SWIPER
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeMap();
    }, 100);
    if (!customElements.get('swiper-container')) {
      import('swiper/element/bundle').then((module) => {
        module.register();
      });
    }
  }

  
//MARKERS
  private addMarkersToMap(): void {
    if (!this.map || !this.mapInitialized) {
      return;
    }
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
    const bounds = L.latLngBounds([]);

    this.supermarkets.forEach(supermarket => {
      const marker = L.marker([supermarket.latitude, supermarket.longitude])
        .addTo(this.map!)
        .on('click', () => this.selectSupermarket(supermarket));

      marker.bindPopup(`
        <strong>${supermarket.name}</strong><br>
        ${supermarket.address}<br>
        ${supermarket.active_offers ? `<span class="offers-badge">${supermarket.active_offers} offerte attive</span>` : ''}
      `);

      this.markers.push(marker);
      bounds.extend([supermarket.latitude, supermarket.longitude]);
    });

    if (bounds.getNorth() !== bounds.getSouth() && bounds.getEast() !== bounds.getWest()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
  selectSupermarket(supermarket: Supermarket): void {
    this.selectedSupermarket = supermarket;
    if (!this.map || !this.mapInitialized) {
      return;
    }
    const marker = this.markers.find(m => 
      m.getLatLng().equals([supermarket.latitude, supermarket.longitude])
    );
    if (marker) {
      marker.openPopup();
    }
    this.map.setView([supermarket.latitude, supermarket.longitude], 15, {
      animate: true,
      duration: 1
    });
    const itemElement = document.querySelector(`[data-supermarket-id="${supermarket.id}"]`);
    if (itemElement) {
      itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }


//BUTTON
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
  openAddSupermarketModal() {
    this.addSupermarketModalOpen = true;
    this.newSupermarket = { name: '', address: '' };
    this.addressSuggestions = [];
  }
  closeAddSupermarketModal() {
    this.addSupermarketModalOpen = false;
  }

//ADDRESS
  onAddressInputDebounced() {
    this.addressInput$.next(this.newSupermarket.address);
    this.selectedLat = '';
    this.selectedLon = '';
  }
  async fetchAddressSuggestions(address: string) {
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
  selectAddressSuggestion(suggestion: any) {
    // se non italia:(NA) via, numero (PR)
    // se italia: via, numero (PR)
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
  async submitAddSupermarket() {
    if (!this.newSupermarket.name || !this.newSupermarket.address || !this.selectedLat || !this.selectedLon) return;
    this.isSubmitting = true;
    try {
      await this.supermarketsService.addSupermarket({
        name: this.newSupermarket.name,
        address: this.newSupermarket.address,
        latitude: this.selectedLat,
        longitude: this.selectedLon
      });
      this.closeAddSupermarketModal();
      this.loadSupermarkets();
    } finally {
      this.isSubmitting = false;
    }
  }

//SM IMAGE
  private supermarketImages: { [key: string]: string } = {
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
    if (key) {
      return this.supermarketImages[key];
    }
    return 'https://www.shutterstock.com/image-vector/products-assortiment-on-supermarket-shelves-260nw-2499860891.jpg';
  }
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
  private loadSupermarkets(): void {
    this.isLoading = true;
    this.supermarketsService.getSupermarkets().subscribe({
      next: (response: { supermarkets: Supermarket[] }) => {
        this.supermarkets = response.supermarkets;
        if (this.userPosition) {
          this.sortSupermarketsByDistance();
        }
        if (this.mapInitialized) {
          this.addMarkersToMap();
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('errore caricamento supermercati:', error);
        this.isLoading = false;
      }
    });
  }

  
//AUTH
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
