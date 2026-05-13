import { Injectable, signal, computed } from '@angular/core';

import { Train } from '../train';
import { TrainView, makeTrainView } from '../train-view';
import { PathResult, SimulationMessage } from '../messages';
import { pathQuerySummary } from '../utils/path-summary';

export interface TrackedPerson {
  id: string;
  nodes: string[];
  loc: { type: 'station' | 'platform' | 'train'; id: string } | null;
}

@Injectable({ providedIn: 'root' })
export class SimulationStateService {

  // ── Trains (domain) ────────────────────────────────────────────────────────
  private readonly _trainsMap = new Map<string, Train>();
  private readonly _trainsSignal = signal<ReadonlyMap<string, Train>>(new Map());
  readonly trains = computed(() => Array.from(this._trainsSignal().values()));

  getTrain(id: string): Train | undefined { return this._trainsMap.get(id); }

  // ── Train views (render state, mutable by renderer) ────────────────────────
  private readonly _trainViewsMap = new Map<string, TrainView>();
  getTrainView(id: string): TrainView | undefined { return this._trainViewsMap.get(id); }
  getTrainViews(): ReadonlyMap<string, TrainView> { return this._trainViewsMap; }

  // ── People counts ──────────────────────────────────────────────────────────
  readonly simulationPeople = signal(0);
  readonly metroPeople      = signal(0);
  readonly trainsPeople     = signal(0);
  readonly timeMultiplier   = signal(1);

  // ── Platform/station people ────────────────────────────────────────────────
  private _platformsPeople  = new Map<string, number>();
  private _stationsPeople   = new Map<string, number>();
  private _andenPeople      = new Map<number, number>();
  private _stationIdPeople  = new Map<string, number>();

  readonly platformsPeople  = signal<ReadonlyMap<string, number>>(new Map());
  readonly stationsPeople   = signal<ReadonlyMap<string, number>>(new Map());
  readonly andenPeople      = signal<ReadonlyMap<number, number>>(new Map());
  readonly stationIdPeople  = signal<ReadonlyMap<string, number>>(new Map());

  // ── Simulation status ──────────────────────────────────────────────────────
  readonly paused       = signal(true);
  readonly simLoad      = signal(0);
  readonly eventsPerTick = signal(0);
  readonly queueSize    = signal(0);

  // ── Persons ────────────────────────────────────────────────────────────────
  readonly personsInTrain = signal<Array<{ id: string; destination: string }>>([]);
  private _personsInPlatform = new Map<string, Array<{ id: string; destination: string }>>();
  readonly personsInPlatform = signal<ReadonlyMap<string, Array<{ id: string; destination: string }>>>(new Map());

  // ── Person tracking ────────────────────────────────────────────────────────
  readonly tracked = signal<TrackedPerson | null>(null);

  // ── Path query ─────────────────────────────────────────────────────────────
  readonly pathQueryResult = signal<PathResult | null>(null);

  initLines(lines: string[]): void {
    for (const line of lines) {
      this._platformsPeople.set(line, 0);
      this._stationsPeople.set(line, 0);
    }
    this.platformsPeople.set(new Map(this._platformsPeople));
    this.stationsPeople.set(new Map(this._stationsPeople));
  }

  trackPerson(id: string): void {
    this.tracked.set({ id, nodes: [], loc: null });
  }

  untrackPerson(): void {
    this.tracked.set(null);
  }

  reset(): void {
    this._trainsMap.clear();
    this._trainViewsMap.clear();
    this._trainsSignal.set(new Map());
    this.simulationPeople.set(0);
    this.metroPeople.set(0);
    this.trainsPeople.set(0);
    for (const key of this._platformsPeople.keys()) this._platformsPeople.set(key, 0);
    for (const key of this._stationsPeople.keys()) this._stationsPeople.set(key, 0);
    this.platformsPeople.set(new Map(this._platformsPeople));
    this.stationsPeople.set(new Map(this._stationsPeople));
    this._andenPeople.clear();
    this.andenPeople.set(new Map());
    this._stationIdPeople.clear();
    this.stationIdPeople.set(new Map());
    this.personsInTrain.set([]);
    this._personsInPlatform.clear();
    this.personsInPlatform.set(new Map());
    this.tracked.set(null);
    this.pathQueryResult.set(null);
  }

  process(msg: SimulationMessage): void {
    switch (msg.message) {
      case 'moveTrain': {
        const train = this._trainsMap.get(msg.train);
        const view  = this._trainViewsMap.get(msg.train);
        if (train && view) {
          view.fromX = view.x;
          view.fromY = view.y;
          view.targetX = msg.x;
          view.targetY = msg.y;
          view.departedAt = performance.now();
          view.travelMs = msg.travelMs ?? 135_000 * this.timeMultiplier();
          if (msg.people   !== undefined) train.people   = msg.people;
          if (msg.capacity !== undefined) train.capacity = msg.capacity;
          if (msg.anden    !== undefined) train.anden    = msg.anden;
          this._trainsSignal.set(new Map(this._trainsMap));
        }
        break;
      }
      case 'newTrain': {
        const existing = this._trainsMap.get(msg.train);
        const viewExisting = this._trainViewsMap.get(msg.train);
        if (existing && viewExisting) {
          viewExisting.fromX = viewExisting.x;
          viewExisting.fromY = viewExisting.y;
          viewExisting.targetX = msg.x;
          viewExisting.targetY = msg.y;
          viewExisting.departedAt = performance.now();
          viewExisting.travelMs = msg.travelMs ?? 135_000 * this.timeMultiplier();
          if (msg.people   !== undefined) existing.people   = msg.people;
          if (msg.capacity !== undefined) existing.capacity = msg.capacity;
          if (msg.anden    !== undefined) existing.anden    = msg.anden;
        } else {
          const t = new Train(msg.train, msg.people ?? 0, msg.capacity ?? 600);
          if (msg.anden !== undefined) t.anden = msg.anden;
          this._trainsMap.set(msg.train, t);
          this._trainViewsMap.set(msg.train, makeTrainView(msg.train, msg.x, msg.y));
        }
        this._trainsSignal.set(new Map(this._trainsMap));
        break;
      }
      case 'removeTrain': {
        this._trainsMap.delete(msg.train);
        this._trainViewsMap.delete(msg.train);
        this._trainsSignal.set(new Map(this._trainsMap));
        break;
      }
      case 'peopleInLinePlatforms':
        this._platformsPeople.set(msg.line.slice(1), msg.people);
        this.platformsPeople.set(new Map(this._platformsPeople));
        break;
      case 'peopleInLineStations':
        this._stationsPeople.set(msg.line.slice(1), msg.people);
        this.stationsPeople.set(new Map(this._stationsPeople));
        break;
      case 'peopleInPlatform':
        this._andenPeople.set(msg.anden, msg.people);
        this.andenPeople.set(new Map(this._andenPeople));
        break;
      case 'peopleInStation':
        this._stationIdPeople.set(msg.stationId, msg.people);
        this.stationIdPeople.set(new Map(this._stationIdPeople));
        break;
      case 'peopleInTrains':
        this.trainsPeople.set(msg.people);
        break;
      case 'peopleInMetro':
        this.metroPeople.set(msg.people);
        break;
      case 'peopleInSimulation':
        this.simulationPeople.set(msg.people);
        break;
      case 'timeMultiplier':
        this.timeMultiplier.set(msg.multiplier);
        break;
      case 'platformOvercrowded':
        console.warn(`Platform overcrowded: ${msg.platform} with ${msg.people}`);
        break;
      case 'stationOvercrowded':
        console.warn(`Station overcrowded: ${msg.platform} with ${msg.people}`);
        break;
      case 'simLoad':
        this.simLoad.set(msg.load);
        this.eventsPerTick.set(msg.eventsPerTick);
        this.queueSize.set(msg.queueSize);
        break;
      case 'simPaused':
        this.paused.set(msg.paused);
        break;
      case 'personsInTrain':
        this.personsInTrain.set(msg.persons);
        break;
      case 'personsInPlatform':
        this._personsInPlatform.set(msg.anderId, msg.persons);
        this.personsInPlatform.set(new Map(this._personsInPlatform));
        break;
      case 'personPath': {
        const t = this.tracked();
        if (t && msg.person === t.id) this.tracked.set({ ...t, nodes: msg.nodes });
        break;
      }
      case 'personLocation': {
        const t = this.tracked();
        if (t && msg.person === t.id) {
          this.tracked.set({ ...t, loc: { type: msg.locType, id: msg.locId } });
        }
        break;
      }
      case 'pathResult':
        this.pathQueryResult.set(msg);
        break;
    }
  }

  pathQuerySummary(): string {
    return pathQuerySummary(this.pathQueryResult());
  }
}
