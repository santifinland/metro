import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { retryWhen, delay, tap } from 'rxjs/operators';
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
      retryWhen(errors =>
        errors.pipe(
          tap(() => this.connectionStatus$.next('reconnecting')),
          delay(2000),
        )
      ),
    );
  }
}
