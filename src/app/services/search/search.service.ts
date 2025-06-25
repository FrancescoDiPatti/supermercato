import { Injectable } from '@angular/core';
import { PosizioneService } from '../posizione/posizione.service';

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

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  constructor(private posizioneService: PosizioneService) { }

  //Levenshtein distance algorithm to compare strings
  distance(a: string, b: string): number {
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

  isSimilar(query: string, target: string, tolerance: number = 0.4): boolean {
    const distance = this.distance(query.toLowerCase(), target.toLowerCase());
    const maxDistance = Math.ceil(query.length * tolerance);
    return distance <= maxDistance;
  }

  // Advanced supermarket search
  search(
    query: string, 
    supermarkets: Supermarket[], 
    userPosition?: { lat: number; lng: number },
    maxResults: number = 8
  ): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    
    // try exact match
    let filtered = supermarkets.filter(sm => 
      sm.name.toLowerCase().includes(lowerQuery) || 
      sm.address.toLowerCase().includes(lowerQuery)
    );

    // if no exact match, try advanced search
    if (filtered.length === 0 && query.length >= 3) {
      const maxDistance = Math.ceil(query.length * 0.4);
      const tolerantMatches = supermarkets
        .map(sm => ({
          supermarket: sm,
          nameDistance: this.distance(lowerQuery, sm.name.toLowerCase()),
          addressDistance: this.distance(lowerQuery, sm.address.toLowerCase())
        }))
        .filter(item => 
          item.nameDistance <= maxDistance || item.addressDistance <= maxDistance
        )
        .sort((a, b) => {
          const aMinDist = Math.min(a.nameDistance, a.addressDistance);
          const bMinDist = Math.min(b.nameDistance, b.addressDistance);
          return aMinDist - bMinDist;
        })
        
        .slice(0, 5);

      filtered = tolerantMatches.map(item => item.supermarket);
    }
    // Order results
    const sorted = filtered.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(lowerQuery);
      const bNameMatch = b.name.toLowerCase().includes(lowerQuery);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      if (userPosition) {
        const distA = this.posizioneService.calcDistance(userPosition.lat, userPosition.lng, a.latitude, a.longitude);
        const distB = this.posizioneService.calcDistance(userPosition.lat, userPosition.lng, b.latitude, b.longitude);
        return distA - distB;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted.slice(0, maxResults).map(sm => ({
      id: sm.id.toString(),
      label: sm.name,      
      sublabel: `${sm.address}${userPosition ? 
        ' • ' + this.posizioneService.formatDistance(this.posizioneService.calcDistance(userPosition.lat, userPosition.lng, sm.latitude, sm.longitude)) : ''}`,
      data: sm,
      type: 'search' as const
    }));
  }
}
