export function computeArcLens(pts: { x: number; y: number }[]): number[] {
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    lens.push(lens[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return lens;
}

export function positionAtArc(
  pts:     { x: number; y: number }[],
  lens:    number[],
  arc:     number,
  hintIdx = 1,
): { x: number; y: number; heading: number; segIdx: number } {
  const total   = lens[lens.length - 1];
  const clamped = Math.max(0, Math.min(total, arc));

  let i = Math.max(1, Math.min(hintIdx, lens.length - 1));
  while (i < lens.length - 1 && lens[i] < clamped) i++;
  while (i > 1 && lens[i - 1] >= clamped) i--;

  const p0     = pts[i - 1];
  const p1     = pts[i];
  const segLen = lens[i] - lens[i - 1];
  const segT   = segLen > 0 ? (clamped - lens[i - 1]) / segLen : 0;

  return {
    x:       p0.x + (p1.x - p0.x) * segT,
    y:       p0.y + (p1.y - p0.y) * segT,
    heading: Math.atan2(p1.y - p0.y, p1.x - p0.x),
    segIdx:  i,
  };
}
