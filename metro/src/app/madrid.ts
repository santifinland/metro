import { Position } from './position'
import { Slot } from './slot'
import { Station } from './station'
import rawStations from '../assets/stations.json'

export class Madrid {
  width: number;
  height: number;
  stations: Station[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.stations = [];
    for (let s of rawStations.features) {
      const position = new Position(width, height, s.geometry.coordinates[1], s.geometry.coordinates[0]);
      const slots: Slot[] = []
      this.stations.push(new Station(s.properties.CODIGOESTACION, s.properties.DENOMINACION, position, slots))
    }
  }
}
