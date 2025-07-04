import { Injectable } from '@angular/core';

// Exported interfaces

export interface LeafletEvent {
  type: string;
  target: any;
  sourceTarget: any;
  propagatedFrom: any;
  layer?: any;
  latlng?: { lat: number; lng: number };
  layerPoint?: { x: number; y: number };
  containerPoint?: { x: number; y: number };
  originalEvent?: Event;
}

export interface Supermarket {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  active_offers?: number;
  manager_id?: string;
}

export interface Position {
  lat: number;
  lng: number;
}

export interface MapOptions {
  center?: [number, number];
  zoom?: number;
  zoomControl?: boolean;
  maxZoom?: number;
  minZoom?: number;
  keyboard?: boolean;
  onClick?: (e: LeafletEvent) => void;
  styling?: {
    borderRadius?: string;
    boxShadow?: string;
  };
}

export interface MarkerOptions {
  radius?: number;
  fillColor?: string;
  color?: string;
  weight?: number;
  opacity?: number;
  fillOpacity?: number;
}

export interface MapSetupResult {
  userMarker?: any;
  markers?: any[];
}

// Constants

const DEFAULT_MAP_OPTIONS = {
  center: [41.9028, 12.4964] as [number, number], // Italy center
  zoom: 6,
  zoomControl: true,
  maxZoom: 20,
  minZoom: 3,
  keyboard: false
};

const DEFAULT_USER_MARKER_OPTIONS: MarkerOptions = {
  radius: 8,
  fillColor: '#4a89f3',
  color: '#ffffff',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.8
};

const MARKER_OFFSET_MULTIPLIER = 0.00002;
const MARKER_ANGLE_SEPARATION = 60;

const DEFAULT_ZOOM_LEVELS = {
  USER_POSITION: 13,
  SUPERMARKET_SELECTION: 15,
  USER_MARKER_UPDATE: 12
} as const;

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private readonly defaultMapOptions = DEFAULT_MAP_OPTIONS;
  private readonly defaultUserMarkerOptions = DEFAULT_USER_MARKER_OPTIONS;

  constructor() { }

  //PUBLIC METHODS

  // Initializes Leaflet
  initializeMap(containerIdOrElement: string | HTMLElement, options: MapOptions = {}): any {
    const L = (window as any).L;
    if (!L) return null;
    
    try {
      const mapOptions = { ...this.defaultMapOptions, ...options };
      const map = this.createMapInstance(L, containerIdOrElement, mapOptions);
      this.addTileLayer(L, map);
      this.addEventHandlers(map, options);
      this.applyStyling(map, options.styling);
      return map;
    } catch (error) {
      console.error('Map initialization error:', error);
      return null;
    }
  }

  // Markers and user setup
  completeMapSetup(
    map: any,
    userPosition?: Position,
    supermarkets?: Supermarket[],
    onMarkerClick?: (supermarket: Supermarket) => void,
    userMarkerCallback?: (marker: any) => void,
    markersCallback?: (markers: any[]) => void
  ): MapSetupResult {
    const result: MapSetupResult = {};

    if (userPosition) {
      result.userMarker = this.createUserMarker(map, userPosition);
      userMarkerCallback?.(result.userMarker);
    }
    
    if (supermarkets?.length) {
      result.markers = this.createSupermarketMarkers(map, supermarkets, onMarkerClick);
      markersCallback?.(result.markers);
    }
    
    return result;
  }

  // User marker
  createUserMarker(map: any, position: Position, options?: MarkerOptions): any {
    if (!map || !position) return null;

    const L = (window as any).L;
    if (!L) return null;

    const markerOptions = { ...this.defaultUserMarkerOptions, ...options };
    return L.circleMarker([position.lat, position.lng], markerOptions).addTo(map);
  }

  // Supermarket markers
  createSupermarketMarkers(
    map: any, 
    supermarkets: Supermarket[], 
    onMarkerClick?: (supermarket: Supermarket) => void
  ): any[] {
    if (!map || !supermarkets.length) return [];
    
    const L = (window as any).L;
    if (!L) return [];
    
    const markers: any[] = [];
    const bounds = L.latLngBounds([]);
    const positionCounts = new Map<string, number>();
    const markerIcon = this.createMarkerIcon(L);
    
    supermarkets.forEach(supermarket => {
      const adjustedPosition = this.calculateMarkerPosition(supermarket, positionCounts);
      const marker = this.createSupermarketMarker(L, adjustedPosition, markerIcon, supermarket, onMarkerClick, markers);
      marker.addTo(map);
      markers.push(marker);
      bounds.extend([adjustedPosition.lat, adjustedPosition.lng]);
    });
    this.fitMapToBounds(map, bounds);
    return markers;
  }

  // Center map on user
  centerOnUserPosition(map: any, position: Position, zoom: number = DEFAULT_ZOOM_LEVELS.USER_POSITION): void {
    if (!map || !position) return;
    
    map.setView([position.lat, position.lng], zoom, {
      animate: true,
      duration: 1
    });
  }

  // Select supermarket on map
  selectSupermarketOnMap(
    supermarket: Supermarket, 
    map: any, 
    markers: any[], 
    fromMarkerClick: boolean = false,
    zoom: number = DEFAULT_ZOOM_LEVELS.SUPERMARKET_SELECTION,
    animationDuration: number = 1
  ): void {
    if (!map) return;
    
    if (!fromMarkerClick) {
      this.closeAllPopups(markers);
    }
    
    const marker = this.findMarkerById(markers, supermarket.id);
    
    if (marker) {
      this.animateToMarker(map, marker, zoom, animationDuration, fromMarkerClick);
    } else {
      this.animateToPosition(map, supermarket, zoom, animationDuration);
    }
    
    this.invalidateMapSize(map);
  }

  //PRIVATE METHODS

  // Creates Leaflet map instance
  private createMapInstance(L: any, containerIdOrElement: string | HTMLElement, mapOptions: any): any {
    return L.map(containerIdOrElement, {
      center: mapOptions.center,
      zoom: mapOptions.zoom,
      zoomControl: mapOptions.zoomControl,
      maxZoom: mapOptions.maxZoom,
      minZoom: mapOptions.minZoom,
      keyboard: mapOptions.keyboard
    });
  }

  // Google Maps tiles
  private addTileLayer(L: any, map: any): void {
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '© Google Maps',
      maxZoom: 20
    }).addTo(map);
  }

  // Map click
  private addEventHandlers(map: any, options: MapOptions): void {
    if (options.onClick) {
      map.on('click', options.onClick);
    }
  }

  // Map styles
  private applyStyling(map: any, styling?: MapOptions['styling']): void {
    if (!styling) return;
    
    const mapContainer = map.getContainer();
    if (styling.borderRadius) {
      mapContainer.style.borderRadius = styling.borderRadius;
    }
    if (styling.boxShadow) {
      mapContainer.style.boxShadow = styling.boxShadow;
    }
  }

  // Marker icon
  private createMarkerIcon(L: any): any {
    return L.icon({
      iconUrl: 'assets/markers/marker-icon.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  }

  // Avoid marker overlap
  private calculateMarkerPosition(supermarket: Supermarket, positionCounts: Map<string, number>): Position {
    const positionKey = `${supermarket.latitude},${supermarket.longitude}`;
    const count = positionCounts.get(positionKey) || 0;
    positionCounts.set(positionKey, count + 1);
    
    const angle = (count * MARKER_ANGLE_SEPARATION) * (Math.PI / 180);
    const offsetLat = Math.sin(angle) * MARKER_OFFSET_MULTIPLIER * count;
    const offsetLng = Math.cos(angle) * MARKER_OFFSET_MULTIPLIER * count;
    
    return {
      lat: supermarket.latitude + offsetLat,
      lng: supermarket.longitude + offsetLng
    };
  }

  // Supermarket marker
  private createSupermarketMarker(
    L: any,
    position: Position,
    icon: any,
    supermarket: Supermarket,
    onMarkerClick?: (supermarket: Supermarket) => void,
    allMarkers?: any[]
  ): any {
    const marker = L.marker([position.lat, position.lng], { icon });
    
    marker.bindPopup(`
      <strong>${supermarket.name}</strong><br>
      ${supermarket.address}
    `);
    
    if (onMarkerClick) {
      marker.on('click', (e: any) => this.handleMarkerClick(e, supermarket, marker, allMarkers, onMarkerClick));
    }
    
    (marker as any).supermarketId = supermarket.id;
    return marker;
  }

  // Marker click
  private handleMarkerClick(
    e: any,
    supermarket: Supermarket,
    marker: any,
    allMarkers: any[] = [],
    onMarkerClick: (supermarket: Supermarket) => void
  ): void {
    e.originalEvent?.stopPropagation();
    allMarkers.forEach(m => {
      if (m !== marker) {
        m.closePopup();
      }
    });
    
    onMarkerClick(supermarket);
    
    if (!marker.isPopupOpen()) {
      marker.openPopup();
    }
  }

  // Fit map to bounds
  private fitMapToBounds(map: any, bounds: any): void {
    if (bounds.getNorth() !== bounds.getSouth() && bounds.getEast() !== bounds.getWest()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // Close popup
  private closeAllPopups(markers: any[]): void {
    markers.forEach(marker => marker?.closePopup());
  }

  // Marker by supermarket ID
  private findMarkerById(markers: any[], supermarketId: number): any {
    return markers.find(marker => (marker as any).supermarketId === supermarketId);
  }

  // Animate map to marker
  private animateToMarker(map: any, marker: any, zoom: number, duration: number, fromMarkerClick: boolean): void {
    const markerLatLng = marker.getLatLng();
    map.setView([markerLatLng.lat, markerLatLng.lng], zoom, {
      animate: true,
      duration
    });
    
    if (!fromMarkerClick) {
      setTimeout(() => marker.openPopup(), duration * 1000 + 200);
    }
  }

  // Animate map to user
  private animateToPosition(map: any, supermarket: Supermarket, zoom: number, duration: number): void {
    map.setView([supermarket.latitude, supermarket.longitude], zoom, {
      animate: true,
      duration
    });
  }

  // Reset map size
  private invalidateMapSize(map: any): void {
    setTimeout(() => map?.invalidateSize(), 200);
  }
  
}
