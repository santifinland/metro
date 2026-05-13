import { lonLatToCanvas } from './utils/projection';

export class Position {
  lat: number;
  lon: number;
  x: number;
  y: number;

  constructor(_width: number, _height: number, lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
    const p = lonLatToCanvas(lon, lat);
    this.x = p.x;
    this.y = p.y;
  }
}
