import { Injectable, DestroyRef, inject } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { retry, timeout } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { webSocket } from 'rxjs/webSocket';

import { environment } from '../../environments/environment';
import { SimulationMessage } from '../messages';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class WebSocketService {

  readonly connectionStatus$ = new BehaviorSubject<ConnectionStatus>('disconnected');
  readonly messages$: Observable<SimulationMessage>;

  private readonly socket$;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.socket$ = webSocket<SimulationMessage>({
      url: environment.wsUrl,
      openObserver: {
        next: () => this.connectionStatus$.next('connected'),
      },
      closeObserver: {
        next: () => this.connectionStatus$.next('reconnecting'),
      },
    });

    this.messages$ = this.socket$.pipe(
      timeout({ each: 30_000 }),
      retry({
        count: 30,
        delay: (_error, _count) => {
          this.connectionStatus$.next('reconnecting');
          return timer(2000);
        },
      }),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  send(msg: object): void {
    this.socket$.next(msg as SimulationMessage);
  }
}
