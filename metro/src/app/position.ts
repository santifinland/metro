export class Position {
  lat: number;
  lon: number;
  x: number;
  y: number;
  radius = 6371;
  phi1 = 40.4202961;
  phi0 = 40.4202961;
  lambda0 = -3.718762;

  constructor(width: number, height: number, lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
    this.x = -this.radius * (lon - this.lambda0) * Math.cos(this.phi1) + (width / 2)
    this.y = -this.radius * (lat - this.phi0) + (height / 2)
  }
}
