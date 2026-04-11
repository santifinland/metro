import { Injectable } from '@angular/core';

import { Train } from '../train';
import { SimulationMessage } from '../messages';

@Injectable({ providedIn: 'root' })
export class SimulationStateService {

  readonly trains: Train[] = [];

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

  process(msg: SimulationMessage): void {
    switch (msg.message) {
      case 'moveTrain': {
        const train = this.trains.find(t => t.id === msg.train);
        if (train) {
          train.x = msg.x;
          train.y = msg.y;
          this.dirty = true;
        }
        break;
      }
      case 'newTrain':
        this.trains.push(new Train(msg.train, msg.x, msg.y));
        this.dirty = true;
        break;
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
