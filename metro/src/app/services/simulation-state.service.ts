import { Injectable } from '@angular/core';

import { Train } from '../train';
import { SimulationMessage } from '../messages';

@Injectable({ providedIn: 'root' })
export class SimulationStateService {

  // Keyed by train ID so newTrain from a snapshot replay does an upsert, not a duplicate push
  private readonly trainsMap = new Map<string, Train>();
  get trains(): Train[] { return Array.from(this.trainsMap.values()); }

  dirty = false;
  simulationPeople = 0;
  metroPeople = 0;
  trainsPeople = 0;
  timeMultiplier = 1;

  readonly platformsPeople = new Map<string, number>();
  readonly stationsPeople = new Map<string, number>();

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
          train.travelMs = 135_000 / this.timeMultiplier;
          if (msg.people   !== undefined) train.people   = msg.people;
          if (msg.capacity !== undefined) train.capacity = msg.capacity;
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
          existing.travelMs = 135_000 / this.timeMultiplier;
          if (msg.people   !== undefined) existing.people   = msg.people;
          if (msg.capacity !== undefined) existing.capacity = msg.capacity;
        } else {
          this.trainsMap.set(msg.train, new Train(msg.train, msg.x, msg.y, msg.people ?? 0, msg.capacity ?? 600));
        }
        this.dirty = true;
        break;
      }
      case 'peopleInLinePlatforms':
        this.platformsPeople.set(msg.line.slice(1), msg.people);
        break;
      case 'peopleInLineStations':
        this.stationsPeople.set(msg.line.slice(1), msg.people);
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
    }
  }
}
