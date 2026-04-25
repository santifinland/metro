import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { HeaderComponent } from './header.component';
import { WebSocketService } from '../services/websocket.service';
import { SimulationStateService } from '../services/simulation-state.service';

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
      providers: [
        { provide: WebSocketService, useValue: mockWs },
        SimulationStateService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should generate a session id string starting with A', () => {
    expect(component.sessionId).toMatch(/^A\d+$/);
  });

  it('should expose connection status observable', (done) => {
    component.status$.subscribe(status => {
      expect(status).toBe('disconnected');
      done();
    });
  });
});
