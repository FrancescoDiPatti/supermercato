import { Injectable } from '@angular/core';

// Leaflet event interface for better typing
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

@Injectable({
  providedIn: 'root'
})
export class MapService {

  constructor() { }

  // === ADVANCED MAP INITIALIZATION ===
  
  initializeMap(
    containerIdOrElement: string | any,
    options: {
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
    } = {}
  ): any {
    if (typeof window === 'undefined') return null;
    
    const L = (window as any).L;
    if (!L) return null;
    
    try {
      const defaultOptions = {
        center: [41.9028, 12.4964] as [number, number],
        zoom: 6,
        zoomControl: true,
        maxZoom: 20,
        minZoom: 3,
        keyboard: false
      };
      
      const mapOptions = { ...defaultOptions, ...options };
      
      // Create map instance
      const map = L.map(containerIdOrElement, {
        center: mapOptions.center,
        zoom: mapOptions.zoom,
        zoomControl: mapOptions.zoomControl,
        maxZoom: mapOptions.maxZoom,
        minZoom: mapOptions.minZoom,
        keyboard: mapOptions.keyboard
      });
      
      // Add tile layer
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20
      }).addTo(map);
      
      // Add click handler if provided
      if (options.onClick) {
        map.on('click', options.onClick);
      }
      
      // Apply styling if provided
      if (options.styling) {
        const mapContainer = map.getContainer();
        if (options.styling.borderRadius) {
          mapContainer.style.borderRadius = options.styling.borderRadius;
        }
        if (options.styling.boxShadow) {
          mapContainer.style.boxShadow = options.styling.boxShadow;
        }
      }
      
      return map;
    } catch (error) {
      console.error('Map initialization error:', error);
      return null;
    }
  }

  // === MAP SETUP COMPLETION ===
  
  completeMapSetup(
    map: any,
    userPosition?: { lat: number; lng: number },
    supermarkets?: Supermarket[],
    onMarkerClick?: (supermarket: Supermarket) => void,
    userMarkerCallback?: (marker: any) => void,
    markersCallback?: (markers: any[]) => void
  ): { userMarker?: any; markers?: any[] } {
    const result: { userMarker?: any; markers?: any[] } = {};
    
    // Add user marker if position is available
    if (userPosition) {
      result.userMarker = this.createUserMarker(map, userPosition);
      if (userMarkerCallback) {
        userMarkerCallback(result.userMarker);
      }
    }
    
    // Add supermarket markers if available
    if (supermarkets && supermarkets.length > 0) {
      result.markers = this.createSupermarketMarkers(map, supermarkets, onMarkerClick);
      if (markersCallback) {
        markersCallback(result.markers);
      }
    }
    
    return result;
  }

  // === MAP INITIALIZATION UTILITIES ===
  
  createMapInstance(containerId: string, options?: any): any {
    const defaultOptions = {
      center: [41.9028, 12.4964], // Italy center
      zoom: 6,
      zoomControl: true,
      maxZoom: 20,
      minZoom: 3,
      keyboard: false
    };
    
    const mapOptions = { ...defaultOptions, ...options };
    
    // Dynamically import Leaflet to avoid SSR issues
    if (typeof window !== 'undefined') {
      const L = (window as any).L;
      if (L) {
        return L.map(containerId, mapOptions);
      }
    }
    return null;
  }

  addGoogleTileLayer(map: any): void {
    if (typeof window !== 'undefined') {
      const L = (window as any).L;
      if (L && map) {
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          attribution: '© Google Maps',
          maxZoom: 20
        }).addTo(map);
      }
    }
  }

  // === MAP UTILITIES ===
  
  createUserMarker(map: any, position: { lat: number; lng: number }, options?: any): any {
    if (typeof window !== 'undefined') {
      const L = (window as any).L;
      if (L && map && position) {
        const defaultOptions = {
          radius: 8,
          fillColor: '#4a89f3',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        };
        const markerOptions = { ...defaultOptions, ...options };
        return L.circleMarker([position.lat, position.lng], markerOptions).addTo(map);
      }
    }
    return null;
  }

  updateUserMarkerPosition(userMarker: any, map: any, position: { lat: number; lng: number }, zoom: number = 12): void {
    if (typeof window !== 'undefined' && userMarker && map && position) {
      userMarker.setLatLng([position.lat, position.lng]);
      map.setView([position.lat, position.lng], zoom);
    }
  }

  createSupermarketMarkers(map: any, supermarkets: Supermarket[], onMarkerClick?: (supermarket: Supermarket) => void): any[] {
    const markers: any[] = [];
    if (typeof window !== 'undefined') {
      const L = (window as any).L;
      if (L && map && supermarkets.length > 0) {
        markers.forEach(marker => marker.remove());
        const markerIcon = L.icon({
          iconUrl: 'assets/markers/marker-icon.png',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });
        
        const bounds = L.latLngBounds([]);
        const positionCounts = new Map<string, number>();

        supermarkets.forEach(supermarket => {
          // Handle overlapping markers with slight offset
          const positionKey = `${supermarket.latitude},${supermarket.longitude}`;
          const count = positionCounts.get(positionKey) || 0;
          positionCounts.set(positionKey, count + 1);
          
          const offsetMultiplier = 0.00002; // about 2 meters
          const angle = (count * 60) * (Math.PI / 180); // 60 degrees separation
          const offsetLat = Math.sin(angle) * offsetMultiplier * count;
          const offsetLng = Math.cos(angle) * offsetMultiplier * count;
          
          const adjustedLat = supermarket.latitude + offsetLat;
          const adjustedLng = supermarket.longitude + offsetLng;
          
          const marker = L.marker([adjustedLat, adjustedLng], { icon: markerIcon }).addTo(map);
          marker.bindPopup(`
            <strong>${supermarket.name}</strong><br>
            ${supermarket.address}
          `);
          
          if (onMarkerClick) {
            marker.on('click', (e: any) => {
              if (e.originalEvent) {
                e.originalEvent.stopPropagation();
              }
              // Close other popups
              markers.forEach(m => {
                if (m !== marker) {
                  m.closePopup();
                }
              });
              onMarkerClick(supermarket);
              if (!marker.isPopupOpen()) {
                marker.openPopup();
              }
            });
          }
          
          (marker as any).supermarketId = supermarket.id;
          markers.push(marker);
          bounds.extend([adjustedLat, adjustedLng]);
        });

        // Fit map to show all markers
        if (bounds.getNorth() !== bounds.getSouth() && bounds.getEast() !== bounds.getWest()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
    return markers;
  }

  clearMarkers(markers: any[]): void {
    markers.forEach(marker => marker.remove());
  }

  // === SUPERMARKET SELECTION UTILITIES ===
  
  selectSupermarketOnMap(
    supermarket: Supermarket, 
    map: any, 
    markers: any[], 
    fromMarkerClick: boolean = false,
    zoom: number = 15,
    animationDuration: number = 1
  ): void {
    if (!map) return;
    
    if (!fromMarkerClick) {
      markers.forEach(m => m.closePopup());
    }
    
    const marker = markers.find(m => (m as any).supermarketId === supermarket.id);
    if (marker) {
      const markerLatLng = marker.getLatLng();
      map.setView([markerLatLng.lat, markerLatLng.lng], zoom, {
        animate: true,
        duration: animationDuration
      });
      
      if (!fromMarkerClick) {
        setTimeout(() => {
          marker.openPopup();
        }, animationDuration * 1000 + 200);
      }
    } else {
      map.setView([supermarket.latitude, supermarket.longitude], zoom, {
        animate: true,
        duration: animationDuration
      });
    }
    
    setTimeout(() => map?.invalidateSize(), 200);
  }
  // === USER POSITION UTILITIES ===

  centerOnUserPosition(map: any, position: { lat: number; lng: number }, zoom: number = 13): void {
    if (typeof window !== 'undefined' && map && position) {
      map.setView([position.lat, position.lng], zoom, {
        animate: true,
        duration: 1
      });
    }
  }
}
