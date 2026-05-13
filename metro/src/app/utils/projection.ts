// Simplified Mercator projection centered on Madrid.
// NOTE: PHI0/COS_P1 use degrees as the numeric value — this matches the
// existing Position.ts convention and the canvas coordinate system.
export const PROJ = {
  LAMBDA0: -3.718762,
  PHI0:    40.4202961,
  RADIUS:  6371,
  COS_P1:  Math.cos(40.4202961),
  CW:      3400,
  CH:      2000,
} as const;

export function lonLatToCanvas(lon: number, lat: number): { x: number; y: number } {
  return {
    x: -PROJ.RADIUS * (lon - PROJ.LAMBDA0) * PROJ.COS_P1 + PROJ.CW / 2,
    y: -PROJ.RADIUS * (lat - PROJ.PHI0)                   + PROJ.CH / 2,
  };
}

export function canvasToLonLat(cx: number, cy: number): { lon: number; lat: number } {
  return {
    lon: PROJ.LAMBDA0 - (cx - PROJ.CW / 2) / (PROJ.RADIUS * PROJ.COS_P1),
    lat: PROJ.PHI0   - (cy - PROJ.CH / 2) / PROJ.RADIUS,
  };
}

export function tileToLonLat(tx: number, ty: number, z: number): { lon: number; lat: number } {
  const n = 2 ** z;
  return {
    lon: tx / n * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI,
  };
}

export function lonLatToTile(lon: number, lat: number, z: number): { tx: number; ty: number } {
  const n      = 2 ** z;
  const latRad = lat * Math.PI / 180;
  return {
    tx: Math.floor((lon + 180) / 360 * n),
    ty: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n),
  };
}
