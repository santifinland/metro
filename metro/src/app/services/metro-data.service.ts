import { Injectable } from '@angular/core';

import { Madrid } from '../madrid';
import { Station } from '../station';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

@Injectable({ providedIn: 'root' })
export class MetroDataService {

  readonly stations: Station[];
  readonly paths: Station[];

  constructor() {
    const madrid = new Madrid(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.stations = madrid.stations;
    this.paths = madrid.paths;
  }
}
