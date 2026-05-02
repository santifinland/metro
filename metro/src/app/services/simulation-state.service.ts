import { Injectable } from '@angular/core';

import { Train } from '../train';
import { SimulationMessage } from '../messages';

@Injectable({ providedIn: 'root' })
export class SimulationStateService {

  // Keyed by train ID so newTrain from a snapshot replay does an upsert, not a duplicate push
  private readonly trainsMap = new Map<string, Train>();
  get trains(): Train[] { return Array.from(this.trainsMap.values()); }
  getTrain(id: string): Train | undefined { return this.trainsMap.get(id); }

  dirty = false;
  simulationPeople = 0;
  metroPeople = 0;
  trainsPeople = 0;
  timeMultiplier = 1;
  paused = true;
  simLoad = 0;
  eventsPerTick = 0;
  queueSize = 0;

  readonly platformsPeople = new Map<string, number>();
  readonly stationsPeople = new Map<string, number>();
  readonly andenPeople = new Map<number, number>();
  readonly stationIdPeople = new Map<string, number>();

  initLines(lines: string[]): void {
    for (const line of lines) {
      this.platformsPeople.set(line, 0);
      this.stationsPeople.set(line, 0);
    }
  }

  reset(): void {
    this.trainsMap.clear();
    this.simulationPeople = 0;
    this.metroPeople = 0;
    this.trainsPeople = 0;
    for (const key of this.platformsPeople.keys()) this.platformsPeople.set(key, 0);
    for (const key of this.stationsPeople.keys()) this.stationsPeople.set(key, 0);
    this.andenPeople.clear();
    this.stationIdPeople.clear();
    this.dirty = true;
  }

  process(msg: SimulationMessage): void {
    switch (msg.message) {
      case 'moveTrain': {
        const train = this.trainsMap.get(msg.train);
        if (train) {
          train.fromX = train.x;
          train.fromY = train.y;
          train.targetX = msg.x;
          train.targetY = msg.y;
          train.departedAt = performance.now();
          train.travelMs = msg.travelMs ?? 135_000 * this.timeMultiplier;
          if (msg.people   !== undefined) train.people   = msg.people;
          if (msg.capacity !== undefined) train.capacity = msg.capacity;
          if (msg.anden    !== undefined) train.anden    = msg.anden;
          this.dirty = true;
        }
        break;
      }
      case 'newTrain': {
        const existing = this.trainsMap.get(msg.train);
        if (existing) {
          existing.fromX = existing.x;
          existing.fromY = existing.y;
          existing.targetX = msg.x;
          existing.targetY = msg.y;
          existing.departedAt = performance.now();
          existing.travelMs = msg.travelMs ?? 135_000 * this.timeMultiplier;
          if (msg.people   !== undefined) existing.people   = msg.people;
          if (msg.capacity !== undefined) existing.capacity = msg.capacity;
          if (msg.anden    !== undefined) existing.anden    = msg.anden;
        } else {
          const t = new Train(msg.train, msg.x, msg.y, msg.people ?? 0, msg.capacity ?? 600);
          if (msg.anden !== undefined) t.anden = msg.anden;
          this.trainsMap.set(msg.train, t);
        }
        this.dirty = true;
        break;
      }
      case 'removeTrain': {
        this.trainsMap.delete(msg.train);
        this.dirty = true;
        break;
      }
      case 'peopleInLinePlatforms':
        this.platformsPeople.set(msg.line.slice(1), msg.people);
        break;
      case 'peopleInLineStations':
        this.stationsPeople.set(msg.line.slice(1), msg.people);
        break;
      case 'peopleInPlatform':
        this.andenPeople.set(msg.anden, msg.people);
        break;
      case 'peopleInStation':
        this.stationIdPeople.set(msg.stationId, msg.people);
        break;
      case 'peopleInTrains':
        this.trainsPeople = msg.people;
        break;
      case 'peopleInMetro':
        this.metroPeople = msg.people;
        break;
      case 'peopleInSimulation':
        this.simulationPeople = msg.people;
        break;
      case 'timeMultiplier':
        this.timeMultiplier = msg.multiplier;
        break;
      case 'platformOvercrowded':
        console.warn(`Platform overcrowded: ${msg.platform} with ${msg.people}`);
        break;
      case 'stationOvercrowded':
        console.warn(`Station overcrowded: ${msg.platform} with ${msg.people}`);
        break;
      case 'simLoad':
        this.simLoad = msg.load;
        this.eventsPerTick = msg.eventsPerTick;
        this.queueSize = msg.queueSize;
        break;
      case 'simPaused':
        this.paused = msg.paused;
        break;
    }
  }
}
