export interface Segment {
  id: string;
  name: string;
  line: string;
  sentido: string;
  path: { x: number; y: number }[];
  position: { x: number; y: number };
  longitudM: number;
  velocidadKmh: number;
}
