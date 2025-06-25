import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreaProdottoPage } from './crea-prodotto.page';

describe('CreaProdottoPage', () => {
  let component: CreaProdottoPage;
  let fixture: ComponentFixture<CreaProdottoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CreaProdottoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
