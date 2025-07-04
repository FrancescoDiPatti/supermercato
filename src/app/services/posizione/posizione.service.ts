import { Injectable } from '@angular/core';

// Exported interfaces

export interface Position {
  lat: number;
  lng: number;
}

export interface AddressDetails {
  road?: string;
  house_number?: string;
  county?: string;
  state_code?: string;
  state?: string;
  country_code?: string;
  display_name?: string;
}

export interface AddressSuggestion {
  lat: string;
  lon: string;
  display_name: string;
  address?: AddressDetails;
}

// Constants

const EARTH_RADIUS_KM = 6371;
const MIN_ADDRESS_LENGTH = 3;
const GEOLOCATION_TIMEOUT = 10000;
const GEOLOCATION_MAX_AGE = 300000;
const NOMINATIM_LIMIT = 5;
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

@Injectable({
  providedIn: 'root'
})
export class PosizioneService {

  constructor() { }

  // PUBLIC METHODS

  // Calculate distance (Haversine formula)
  calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return EARTH_RADIUS_KM * c;
  }

  // Format distance
  formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  }

  // Calculate distance from user
  getDistanceFromUser(userPosition: Position | null, latitude: number, longitude: number): string | null {
    if (!userPosition) return null;
    
    const distance = this.calcDistance(
      userPosition.lat,
      userPosition.lng,
      latitude,
      longitude
    );
    
    return this.formatDistance(distance);
  }

  // Get current user position
  async getCurrentPosition(): Promise<Position | null> {
    if (!this.isGeolocationSupported()) {
      console.warn('Geolocation not supported');
      return null;
    }

    try {
      return await this.requestGeolocation();
    } catch (error) {
      console.warn('Could not get location:', error);
      return null;
    }
  }

  // Format address
  formatAddress(suggestion: AddressSuggestion, inputAddress: string): string {
    const address = suggestion.address || {};
    let formatted = '';

    if (this.shouldAddCountryPrefix(address)) {
      formatted += `(${address.country_code!.toUpperCase()}) `;
    }

    if (address.road) {
      formatted += address.road;
    }

    const houseNumber = this.extractHouseNumber(address, inputAddress);
    if (houseNumber) {
      formatted += `, ${houseNumber}`;
    }

    const province = this.extractProvince(address);
    if (province) {
      formatted += ` (${province})`;
    }
    
    return formatted.trim();
  }

  // Fetch address suggestions
  async fetchAddressSuggestions(address: string): Promise<AddressSuggestion[]> {
    if (!address || address.length < MIN_ADDRESS_LENGTH) {
      return [];
    }

    try {
      const url = this.buildNominatimUrl(address);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      return [];
    }
  }

  // PRIVATE METHODS

  // Convert degrees to radiants
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Check if geolocation is supported
  private isGeolocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  // Request position from browser
  private requestGeolocation(): Promise<Position> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: GEOLOCATION_TIMEOUT,
          maximumAge: GEOLOCATION_MAX_AGE
        }
      );
    });
  }

  // Check if country prefix
  private shouldAddCountryPrefix(address: AddressDetails): boolean {
    return !!(address.country_code && address.country_code.toUpperCase() !== 'IT');
  }

  // Extract house number from addewss
  private extractHouseNumber(address: AddressDetails, inputAddress: string): string | null {
    if (address.house_number) {
      return address.house_number;
    }

    const match = inputAddress.match(/\b(\d{1,5}[a-zA-Z]?)\b(?!.*\b\d{1,5}[a-zA-Z]?\b)/);
    return match ? match[1] : null;
  }

  // Extract province from address
  private extractProvince(address: AddressDetails): string {
    if (address.county) {
      return address.county.substring(0, 2).toUpperCase();
    }
    
    if (address.state_code) {
      return address.state_code.substring(0, 2).toUpperCase();
    }
    
    if (address.state) {
      return address.state.substring(0, 2).toUpperCase();
    }

    if (address.display_name) {
      const match = address.display_name.match(/\((\w{2})\)/);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return '';
  }

  // Nonminatim URL builder
  private buildNominatimUrl(address: string): string {
    const params = new URLSearchParams({
      format: 'json',
      q: address,
      addressdetails: '1',
      limit: NOMINATIM_LIMIT.toString()
    });
    
    return `${NOMINATIM_BASE_URL}?${params.toString()}`;
  }
}
