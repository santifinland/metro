import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { HeaderComponent } from './header.component';
import { WebSocketService } from '../services/websocket.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  const mockWs = {
    connectionStatus$: new BehaviorSubject('disconnected'),
    messages$: new BehaviorSubject(null),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [{ provide: WebSocketService, useValue: mockWs }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('statusIcon should return wifi for connected', () => {
    expect(component.statusIcon('connected')).toBe('wifi');
  });

  it('statusIcon should return wifi_find for reconnecting', () => {
    expect(component.statusIcon('reconnecting')).toBe('wifi_find');
  });

  it('statusIcon should return wifi_off for disconnected', () => {
    expect(component.statusIcon('disconnected')).toBe('wifi_off');
  });

  it('statusColor should return green for connected', () => {
    expect(component.statusColor('connected')).toBe('#4caf50');
  });
});
