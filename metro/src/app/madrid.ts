import {Position} from './position'
import {Slot} from './slot'
import {Station} from './station'
import rawStations from '../assets/stations.json'
import rawPaths from '../assets/tramos.json'

export class Madrid {
  width: number;
  height: number;
  stations: Station[];
  paths: Station[];


  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.stations = [];
    this.paths = [];
    for (let p of rawPaths.features) {
      const path: Position[] = []
      for (let c of p.geometry.coordinates) {
        const position = new Position(width, height, c[1], c[0]);
        path.push(position)
      }
      const position = new Position(width, height, p.geometry.coordinates.reverse()[0][1],
        p.geometry.coordinates.reverse()[0][0]);
      const slots: Slot[] = []
      const station = new Station(p.properties.CODIGOANDEN.toString(), p.properties.DENOMINACION,
        p.properties.NUMEROLINEAUSUARIO, position, path, p.properties.SENTIDO, slots)
      this.paths.push(station)
    }
    for (let s of rawStations.features) {
      console.log(s.properties.DENOMINACION)
      if (this.stations.filter(x => x.name === s.properties.DENOMINACION).length == 0) {
        const position = new Position(width, height, s.geometry.coordinates[1], s.geometry.coordinates[0]);
        const path: Position[] = []
        const slots: Slot[] = []
        const station = new Station("", s.properties.DENOMINACION, "", position, path,
          "", slots)
        this.stations.push(station)
      }
    }
  }
}
