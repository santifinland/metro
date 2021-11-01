import { Position } from './position'
import { Slot } from './slot'

export class Station {
  name: string;
  position: Position;
  empty: boolean;
  slots: Slot[];
  next: any;

  constructor(name: string, position: Position, slots: Slot[], next?: Station) {
    this.name = name;
    this.position = position;
    this.empty = true;
    this.slots = slots;
    this.next = next;
  }
}
