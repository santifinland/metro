import { TestBed } from '@angular/core/testing';
import { WebSocketService, ConnectionStatus } from './websocket.service';

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose connectionStatus$ as BehaviorSubject starting disconnected', () => {
    let status: ConnectionStatus | undefined;
    service.connectionStatus$.subscribe(s => (status = s));
    expect(status).toBe('disconnected');
  });

  it('should expose messages$ as an Observable', () => {
    expect(service.messages$).toBeDefined();
    expect(typeof service.messages$.subscribe).toBe('function');
  });
});
