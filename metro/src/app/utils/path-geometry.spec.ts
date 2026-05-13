import { computeArcLens, positionAtArc } from './path-geometry';

const pts = [
  { x: 0, y: 0 },
  { x: 3, y: 4 },  // distance = 5
  { x: 3, y: 9 },  // distance = 5 more → total 10
];

describe('computeArcLens', () => {
  it('starts at 0', () => {
    const lens = computeArcLens(pts);
    expect(lens[0]).toBe(0);
  });

  it('computes cumulative arc lengths correctly', () => {
    const lens = computeArcLens(pts);
    expect(lens[1]).toBeCloseTo(5, 5);
    expect(lens[2]).toBeCloseTo(10, 5);
  });

  it('returns single-element array for single point', () => {
    const lens = computeArcLens([{ x: 0, y: 0 }]);
    expect(lens).toEqual([0]);
  });
});

describe('positionAtArc', () => {
  let lens: number[];
  beforeEach(() => { lens = computeArcLens(pts); });

  it('returns start of path at arc=0', () => {
    const r = positionAtArc(pts, lens, 0);
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(0, 5);
  });

  it('returns end of path at arc=total', () => {
    const r = positionAtArc(pts, lens, 10);
    expect(r.x).toBeCloseTo(3, 5);
    expect(r.y).toBeCloseTo(9, 5);
  });

  it('interpolates midpoint correctly', () => {
    const r = positionAtArc(pts, lens, 5);
    expect(r.x).toBeCloseTo(3, 5);
    expect(r.y).toBeCloseTo(4, 5);
  });

  it('clamps values beyond total', () => {
    const r = positionAtArc(pts, lens, 999);
    expect(r.x).toBeCloseTo(3, 5);
    expect(r.y).toBeCloseTo(9, 5);
  });

  it('returns correct heading', () => {
    const r = positionAtArc(pts, lens, 2.5);
    expect(r.heading).toBeCloseTo(Math.atan2(4, 3), 5);
  });
});
