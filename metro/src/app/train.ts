
export class Train {
  id: string;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  departedAt: number;
  travelMs: number;
  people: number;
  capacity: number;
  anden: number;
  // Path geometry for track-following animation
  pathPoints: { x: number; y: number }[];
  heading: number;
  line: string;

  constructor(id: string, x: number, y: number, people = 0, capacity = 600) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.fromX = x;
    this.fromY = y;
    this.targetX = x;
    this.targetY = y;
    this.departedAt = 0;
    this.travelMs = 0;
    this.people = people;
    this.capacity = capacity;
    this.anden = 0;
    this.pathPoints = [];
    this.heading = 0;
    this.line = '';
  }
}
