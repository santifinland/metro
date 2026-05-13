import { lonLatToCanvas } from './utils/projection';
import { Segment } from './domain/segment';
import rawStations from '../assets/stations.json';
import rawPaths from '../assets/tramos.json';

export interface StationInfo {
  name: string;
  position: { x: number; y: number };
}

export class Madrid {
  readonly stations: StationInfo[];
  readonly segments: Segment[];
  readonly stationsByCode: Map<string, StationInfo> = new Map();

  constructor(_width: number, _height: number) {
    // Build segments from tramos.json
    this.segments = rawPaths.features.map(f => {
      const path = f.geometry.coordinates.map(c => lonLatToCanvas(c[0], c[1]));
      const last = f.geometry.coordinates[f.geometry.coordinates.length - 1];
      const position = lonLatToCanvas(last[0], last[1]);
      return {
        id:           f.properties.CODIGOANDEN.toString(),
        name:         f.properties.DENOMINACION,
        line:         f.properties.NUMEROLINEAUSUARIO,
        sentido:      f.properties.SENTIDO,
        path,
        position,
        longitudM:    f.properties.LONGITUDTRAMOANTERIOR ?? 0,
        velocidadKmh: f.properties.VELOCIDADTRAMOANTERIOR ?? 0,
      } satisfies Segment;
    });

    // Build deduplicated stations from stations.json
    const seen = new Set<string>();
    this.stations = [];
    for (const s of rawStations.features) {
      const name = s.properties.DENOMINACION;
      if (!seen.has(name)) {
        seen.add(name);
        this.stations.push({ name, position: lonLatToCanvas(s.geometry.coordinates[0], s.geometry.coordinates[1]) });
      }
    }

    // Map CODIGOESTACION → StationInfo
    for (const s of rawStations.features) {
      const code = s.properties.CODIGOESTACION?.toString();
      if (code) {
        const info = this.stations.find(x => x.name === s.properties.DENOMINACION);
        if (info) this.stationsByCode.set(code, info);
      }
    }
  }
}
