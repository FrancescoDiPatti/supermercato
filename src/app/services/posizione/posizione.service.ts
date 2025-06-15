import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PosizioneService {

  constructor() { }

  // === GEOGRAPHIC UTILITIES ===
  
  // Haversine formula for distance calculation
  calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  // Convert degrees to radians
  deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Format meters or kilometers
  formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  }

  // === DISTANCE UTILITIES (ENHANCED) ===
  
  getDistanceFromUser(userPosition: { lat: number; lng: number } | null, latitude: number, longitude: number): string | null {
    if (!userPosition) return null;
    
    const distance = this.calcDistance(
      userPosition.lat,
      userPosition.lng,
      latitude,
      longitude
    );
    
    return this.formatDistance(distance);
  }

  // === GEOLOCATION UTILITIES ===
  
  async getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
    try {
      if ('geolocation' in navigator) {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            },
            (error) => {
              console.warn('Could not get location:', error);
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000 // 5 minutes cache
            }
          );
        });
      }
      return null;
    } catch (error) {
      console.warn('Geolocation not supported:', error);
      return null;
    }
  }

  // === ADDRESS FORMATTING UTILITIES ===
  
  formatAddress(suggestion: any, inputAddress: string): string {
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
      const match = inputAddress.match(/\b(\d{1,5}[a-zA-Z]?)\b(?!.*\b\d{1,5}[a-zA-Z]?\b)/);
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
    
    return formatted.trim();
  }

  async fetchAddressSuggestions(address: string): Promise<any[]> {
    if (!address || address.length < 3) {
      return [];
    }
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1&limit=5`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (e) {
      return [];
    }
  }
}
