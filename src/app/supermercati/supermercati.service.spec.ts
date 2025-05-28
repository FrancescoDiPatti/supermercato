import { TestBed } from '@angular/core/testing';

import { SupermercatiService } from './supermercati.service';

describe('SupermercatiService', () => {
  let service: SupermercatiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupermercatiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
