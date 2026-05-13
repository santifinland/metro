import { TestBed } from '@angular/core/testing';
import { TileService } from './tile.service';

describe('TileService', () => {
  let svc: TileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(TileService);
  });

  describe('zoomFor', () => {
    it('returns 12 at very small scale', () => expect(svc.zoomFor(0.1)).toBe(12));
    it('returns 13 between 0.3 and 0.7', () => expect(svc.zoomFor(0.5)).toBe(13));
    it('returns 14 between 0.7 and 1.5', () => expect(svc.zoomFor(1.0)).toBe(14));
    it('returns 15 between 1.5 and 3', () => expect(svc.zoomFor(2.0)).toBe(15));
    it('returns 16 above 3', () => expect(svc.zoomFor(5.0)).toBe(16));
  });

  describe('getTile', () => {
    it('returns null on first request (loads asynchronously)', () => {
      const result = svc.getTile(14, 8073, 6119, () => {});
      expect(result).toBeNull();
    });

    it('caches the tile on second call after image creation', () => {
      svc.getTile(14, 8073, 6119, () => {});
      const second = svc.getTile(14, 8073, 6119, () => {});
      // Second call should return the cached (possibly incomplete) image object
      expect(second).not.toBeNull();
    });
  });
});
