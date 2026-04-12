
export class Train {
  id: string;
  x: number;
  y: number;
  people: number;
  capacity: number;

  constructor(id: string, x: number, y: number, people = 0, capacity = 600) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.people = people;
    this.capacity = capacity;
  }
}
