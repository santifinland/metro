import { Position } from './position'
import { Slot } from './slot'

export class Station {
  id: string;
  name: string;
  line: string;
  position: Position;
  path: Position[];
  sentido: string;
  empty: boolean;
  slots: Slot[];
  next: any;
  people: number;

  constructor(id: string, name: string, line: string, position: Position, path: Position[], sentido: string,
              slots: Slot[], next?: Station) {
    this.id = id;
    this.name = name;
    this.line = line;
    this.position = position;
    this.path = path;
    this.sentido = sentido;
    this.empty = true;
    this.slots = slots;
    this.next = next;
    this.people = 0
  }
}
