import { TestBed } from '@angular/core/testing';

import { OpenFoodFactsService } from './openfoodfacts.service';

describe('OpenFoodFactsService', () => {
  let service: OpenFoodFactsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OpenFoodFactsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
