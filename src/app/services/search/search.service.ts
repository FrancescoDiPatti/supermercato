import { Injectable } from '@angular/core';
import { PosizioneService } from '../posizione/posizione.service';

// Exported interfaces

export interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  data?: any;
  type: 'search' | 'recent';
  icon?: string;
}

export interface RecentSearch {
  query: string;
  timestamp: number;
  type: string;
  userId: number;
  data?: any;
  resultId?: string;
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

// Constants

const DEFAULT_SEARCH_OPTIONS = {
  MAX_RESULTS: 8,
  MIN_QUERY_LENGTH: 3,
  SIMILARITY_TOLERANCE: 0.4,
  FUZZY_SEARCH_LIMIT: 5
} as const;

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  constructor(private posizioneService: PosizioneService) { }

  // PUBLIC METHODS

  // Supermarket search
  search(
    query: string, 
    supermarkets: Supermarket[], 
    userPosition?: { lat: number; lng: number },
    maxResults: number = DEFAULT_SEARCH_OPTIONS.MAX_RESULTS
  ): SearchResult[] {
    const normalizedQuery = query.toLowerCase();
    let filteredSupermarkets = this.performExactSearch(normalizedQuery, supermarkets);

    if (filteredSupermarkets.length === 0 && query.length >= DEFAULT_SEARCH_OPTIONS.MIN_QUERY_LENGTH) {
      filteredSupermarkets = this.performFuzzySearch(normalizedQuery, supermarkets);
    }

    const sortedSupermarkets = this.sortSearchResults(filteredSupermarkets, normalizedQuery, userPosition);
    return this.formatSearchResults(sortedSupermarkets, userPosition, maxResults);
  }

  // PRIVATE METHODS

  // Exact string match
  private performExactSearch(query: string, supermarkets: Supermarket[]): Supermarket[] {
    return supermarkets.filter(sm => 
      sm.name.toLowerCase().includes(query) || 
      sm.address.toLowerCase().includes(query)
    );
  }

  // Fuzzy search
  private performFuzzySearch(query: string, supermarkets: Supermarket[]): Supermarket[] {
    const maxDistance = Math.ceil(query.length * DEFAULT_SEARCH_OPTIONS.SIMILARITY_TOLERANCE);
    const candidatesWithDistance = supermarkets
      .map(sm => ({
        supermarket: sm,
        nameDistance: this.calculateLevenshteinDistance(query, sm.name.toLowerCase()),
        addressDistance: this.calculateLevenshteinDistance(query, sm.address.toLowerCase())
      }))
      .filter(item => 
        item.nameDistance <= maxDistance || item.addressDistance <= maxDistance
      )
      .sort((a, b) => {
        const aMinDistance = Math.min(a.nameDistance, a.addressDistance);
        const bMinDistance = Math.min(b.nameDistance, b.addressDistance);
        return aMinDistance - bMinDistance;
      }).slice(0, DEFAULT_SEARCH_OPTIONS.FUZZY_SEARCH_LIMIT);

    return candidatesWithDistance.map(item => item.supermarket);
  }

  // Sort results by name and distance
  private sortSearchResults(
    supermarkets: Supermarket[], 
    query: string, 
    userPosition?: { lat: number; lng: number }
  ): Supermarket[] {
    return supermarkets.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(query);
      const bNameMatch = b.name.toLowerCase().includes(query);
      
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      if (userPosition) {
        const distanceA = this.posizioneService.calcDistance(
          userPosition.lat, userPosition.lng, a.latitude, a.longitude
        );
        const distanceB = this.posizioneService.calcDistance(
          userPosition.lat, userPosition.lng, b.latitude, b.longitude
        );
        return distanceA - distanceB;
      }
      return a.name.localeCompare(b.name);
    });
  }

  // Format supermarket search results
  private formatSearchResults(
    supermarkets: Supermarket[], 
    userPosition?: { lat: number; lng: number }, 
    maxResults: number = DEFAULT_SEARCH_OPTIONS.MAX_RESULTS
  ): SearchResult[] {
    return supermarkets.slice(0, maxResults).map(sm => ({
      id: sm.id.toString(),
      label: sm.name,      
      sublabel: this.buildSublabel(sm, userPosition),
      data: sm,
      type: 'search' as const
    }));
  }

  // sublabel address distance
  private buildSublabel(supermarket: Supermarket, userPosition?: { lat: number; lng: number }): string {
    let sublabel = supermarket.address;
    
    if (userPosition) {
      const distance = this.posizioneService.calcDistance(
        userPosition.lat, userPosition.lng, 
        supermarket.latitude, supermarket.longitude
      );
      const formattedDistance = this.posizioneService.formatDistance(distance);
      sublabel += ` • ${formattedDistance}`;
    }
    return sublabel;
  }

  // Levenshtein distance
  private calculateLevenshteinDistance(a: string, b: string): number {
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
}
