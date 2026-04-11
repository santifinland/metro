import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { retry, tap } from 'rxjs/operators';
import { webSocket } from 'rxjs/webSocket';

import { environment } from '../../environments/environment';
import { SimulationMessage } from '../messages';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class WebSocketService {

  readonly connectionStatus$ = new BehaviorSubject<ConnectionStatus>('disconnected');
  readonly messages$: Observable<SimulationMessage>;

  constructor() {
    const socket$ = webSocket<SimulationMessage>({
      url: environment.wsUrl,
      openObserver: {
        next: () => this.connectionStatus$.next('connected'),
      },
      closeObserver: {
        next: () => this.connectionStatus$.next('reconnecting'),
      },
    });

    this.messages$ = socket$.pipe(
      retry({
        delay: (_error, _count) => {
          this.connectionStatus$.next('reconnecting');
          return timer(2000);
        },
      }),
    );
  }
}
