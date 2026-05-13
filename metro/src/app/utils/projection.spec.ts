import { lonLatToCanvas, canvasToLonLat, lonLatToTile, tileToLonLat } from './projection';

const TOL = 1e-6;

describe('projection round-trip', () => {
  const cases = [
    { lon: -3.718762, lat: 40.4202961 },  // center Madrid
    { lon: -3.6,      lat: 40.5        },
    { lon: -3.9,      lat: 40.3        },
  ];

  for (const { lon, lat } of cases) {
    it(`lon/lat → canvas → lon/lat for (${lon}, ${lat})`, () => {
      const { x, y } = lonLatToCanvas(lon, lat);
      const back = canvasToLonLat(x, y);
      expect(Math.abs(back.lon - lon)).toBeLessThan(TOL);
      expect(Math.abs(back.lat - lat)).toBeLessThan(TOL);
    });
  }
});

describe('tile conversions', () => {
  it('lonLatToTile and tileToLonLat are consistent', () => {
    const lon = -3.718762, lat = 40.4202961, z = 14;
    const { tx, ty } = lonLatToTile(lon, lat, z);
    const back = tileToLonLat(tx, ty, z);
    // Tile coords are integers so back is the tile's NW corner — just verify order of magnitude
    expect(Math.abs(back.lon - lon)).toBeLessThan(1);
    expect(Math.abs(back.lat - lat)).toBeLessThan(1);
  });
});
