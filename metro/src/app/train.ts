import { Position } from './position'

export class Train {
  id: string;
  position: Position;

  constructor(id: string, position: Position) {
    this.id = id;
    this.position = position;
  }
}
