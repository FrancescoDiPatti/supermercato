import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CarrelloPage } from './carrello.page';

describe('CarrelloPage', () => {
  let component: CarrelloPage;
  let fixture: ComponentFixture<CarrelloPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CarrelloPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
