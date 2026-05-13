import { TestBed } from '@angular/core/testing';
import { PathGeometryService } from './path-geometry.service';
import { MetroDataService } from './metro-data.service';
import { Segment } from '../domain/segment';

function makeSeg(id: string, line: string, sentido: string,
                 path: { x: number; y: number }[]): Segment {
  return { id, name: id, line, sentido, path,
           position: path[path.length - 1], longitudM: 0, velocidadKmh: 0 };
}

describe('PathGeometryService', () => {
  let svc: PathGeometryService;

  const seg1 = makeSeg('1', 'L1', 'A', [{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  const seg2 = makeSeg('2', 'L1', 'A', [{ x: 5, y: 0 }, { x: 10, y: 0 }]);
  const seg3 = makeSeg('3', 'L1', 'A', [{ x: 10, y: 0 }, { x: 15, y: 0 }]);
  const detached = makeSeg('4', 'L1', 'A', [{ x: 100, y: 100 }, { x: 200, y: 100 }]);

  const mockMetroData = { segments: [seg1, seg2, seg3, detached], stationsByCode: new Map() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PathGeometryService,
        { provide: MetroDataService, useValue: mockMetroData },
      ],
    });
    svc = TestBed.inject(PathGeometryService);
  });

  describe('buildCompositePath', () => {
    it('isolated segment returns its own path with correct segStart/segEnd', () => {
      const r = svc.buildCompositePath(makeSeg('x', 'L2', 'B', [{ x: 0, y: 0 }, { x: 1, y: 0 }]));
      expect(r.path.length).toBe(2);
      expect(r.segStart).toBeCloseTo(0);
      expect(r.segEnd).toBeCloseTo(1);
    });

    it('prepends prev segment when connected', () => {
      const r = svc.buildCompositePath(seg2);
      // seg1 connects to seg2 (seg1.end = {5,0} = seg2.start)
      expect(r.path[0]).toEqual({ x: 0, y: 0 });
      expect(r.segStart).toBeCloseTo(5); // length of seg1
    });

    it('appends next segment when connected', () => {
      const r = svc.buildCompositePath(seg2);
      // seg3 starts at {10,0} = seg2.end
      const lastPt = r.path[r.path.length - 1];
      expect(lastPt).toEqual({ x: 15, y: 0 });
    });

    it('does not connect detached segment (gap > CONNECT_SQ)', () => {
      const r = svc.buildCompositePath(detached);
      expect(r.path.length).toBe(2);
      expect(r.path[0]).toEqual({ x: 100, y: 100 });
    });
  });

  describe('buildPersonRailPath', () => {
    it('returns empty array for empty nodes', () => {
      expect(svc.buildPersonRailPath([])).toEqual([]);
    });

    it('ignores station nodes', () => {
      expect(svc.buildPersonRailPath(['Station_X'])).toEqual([]);
    });

    it('builds path from platform nodes matching segments', () => {
      const pts = svc.buildPersonRailPath(['Platform_1']);
      expect(pts.length).toBe(2);
      expect(pts[0]).toEqual({ x: 0, y: 0 });
    });
  });
});
