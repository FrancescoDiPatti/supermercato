import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OffertePage } from './offerte.page';

describe('OffertePage', () => {
  let component: OffertePage;
  let fixture: ComponentFixture<OffertePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(OffertePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
