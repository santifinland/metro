import { Injectable, DestroyRef, inject } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { retry, share, timeout } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { webSocket } from 'rxjs/webSocket';

import { environment } from '../../environments/environment';
import { OutgoingMessage, SimulationMessage } from '../messages';

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
      timeout({ each: 120_000 }),
      retry({
        count: 30,
        delay: (_error, _count) => {
          this.connectionStatus$.next('reconnecting');
          return timer(2000);
        },
      }),
      takeUntilDestroyed(this.destroyRef),
      share(),
    );
  }

  send(msg: OutgoingMessage): void {
    this.socket$.next(msg as unknown as SimulationMessage);
  }

  pause():                               void { this.send({ message: 'pause' }); }
  resume():                              void { this.send({ message: 'resume' }); }
  reset():                               void { this.send({ message: 'reset' }); }
  setSpeed(factor: number):              void { this.send({ message: 'setSpeed', factor }); }
  trackPerson(personId: string):         void { this.send({ message: 'trackPerson', personId }); }
  untrackPerson():                       void { this.send({ message: 'untrackPerson' }); }
  requestPlatformPersons(platformId: string): void { this.send({ message: 'requestPlatformPersons', platformId }); }
  requestTrainPersons(trainId: string):  void { this.send({ message: 'requestTrainPersons', trainId }); }
  queryPath(from: string, to: string):   void { this.send({ message: 'queryPath', from, to }); }
}
