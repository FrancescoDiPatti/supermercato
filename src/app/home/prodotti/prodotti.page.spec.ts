import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProdottiPage } from './prodotti.page';

describe('ProdottiPage', () => {
  let component: ProdottiPage;
  let fixture: ComponentFixture<ProdottiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProdottiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
