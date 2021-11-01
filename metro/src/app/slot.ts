import { Position } from './position'

export class Slot {
  position: Position;
  empty: boolean

  constructor(position: Position, empty: boolean) {
    this.position = position;
    this.empty = empty;

  }
}
