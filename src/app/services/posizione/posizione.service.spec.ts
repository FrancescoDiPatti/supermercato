import { TestBed } from '@angular/core/testing';

import { PosizioneService } from './posizione.service';

describe('PosizioneService', () => {
  let service: PosizioneService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PosizioneService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
