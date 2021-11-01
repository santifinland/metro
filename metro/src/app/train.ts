import { Position } from './position'

export class Train {
  position: Position;
  id: number;

  constructor(id: number, position: Position) {
    this.id = id;
    this.position = position;
  }
}
