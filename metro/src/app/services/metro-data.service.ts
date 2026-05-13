import { Injectable } from '@angular/core';

import { Madrid, StationInfo } from '../madrid';
import { Segment } from '../domain/segment';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import rawPaths from '../../assets/tramos.json';

@Injectable({ providedIn: 'root' })
export class MetroDataService {

  readonly stations: StationInfo[];
  readonly segments: Segment[];
  readonly stationsByCode: Map<string, StationInfo>;
  readonly lineDestinations: Map<string, string>;

  constructor() {
    const madrid = new Madrid(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.stations = madrid.stations;
    this.segments = madrid.segments;
    this.stationsByCode = madrid.stationsByCode;

    // Build map: "line/sentido" → terminal station name (highest NUMEROORDEN)
    const maxOrder = new Map<string, { order: number; name: string }>();
    for (const f of rawPaths.features) {
      const p = f.properties;
      const key = `${p.NUMEROLINEAUSUARIO}/${p.SENTIDO}`;
      const order = p.NUMEROORDEN ?? 0;
      const cur = maxOrder.get(key);
      if (!cur || order > cur.order) maxOrder.set(key, { order, name: p.DENOMINACION });
    }
    this.lineDestinations = new Map();
    maxOrder.forEach((v, k) => this.lineDestinations.set(k, v.name));
  }
}
