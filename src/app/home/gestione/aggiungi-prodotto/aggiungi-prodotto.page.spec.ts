import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AggiungiProdottoPage } from './aggiungi-prodotto.page';

describe('AggiungiProdottoPage', () => {
  let component: AggiungiProdottoPage;
  let fixture: ComponentFixture<AggiungiProdottoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AggiungiProdottoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
