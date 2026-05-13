export interface TrainView {
  id: string;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  departedAt: number;
  travelMs: number;
  pathPoints: { x: number; y: number }[];
  pathArcLens: number[];
  pathSegStart: number;
  pathSegEnd: number;
  heading: number;
}

export function makeTrainView(id: string, x: number, y: number): TrainView {
  return { id, x, y, fromX: x, fromY: y, targetX: x, targetY: y,
           departedAt: 0, travelMs: 0, pathPoints: [], pathArcLens: [],
           pathSegStart: 0, pathSegEnd: 0, heading: 0 };
}
