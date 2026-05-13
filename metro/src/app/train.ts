export class Train {
  id: string;
  people: number;
  capacity: number;
  line: string;
  anden: number;

  constructor(id: string, people = 0, capacity = 600) {
    this.id = id;
    this.people = people;
    this.capacity = capacity;
    this.line = '';
    this.anden = 0;
  }
}
