import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SupermercatiPage } from './supermercati.page';

describe('SupermercatiPage', () => {
  let component: SupermercatiPage;
  let fixture: ComponentFixture<SupermercatiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SupermercatiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
