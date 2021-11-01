import { Position } from './position'

export class Station {
  ppio: Position;
  opera: Position;
  sol: Position
  atocha: Position;
  ccasal: Position;

  constructor(width: number, height: number) {
    this.ppio = new Position(width, height, 40.42118636456124, -3.7192746085169675)
    this.opera = new Position(width, height, 40.41809969956107, -3.7093573032619553)
    this.sol = new Position(width, height, 40.416947964333424, -3.7034194154821765)
    this.atocha = new Position(width, height, 40.40649353898929, -3.689455973342957)
    this.ccasal = new Position(width, height, 40.40709162428091, -3.670025473949972)

  }
}
