import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrdiniPage } from './ordini.page';

describe('OrdiniPage', () => {
  let component: OrdiniPage;
  let fixture: ComponentFixture<OrdiniPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(OrdiniPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
