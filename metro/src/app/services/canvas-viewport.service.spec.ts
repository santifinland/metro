import { TestBed } from '@angular/core/testing';
import { CanvasViewportService } from './canvas-viewport.service';

describe('CanvasViewportService', () => {
  let svc: CanvasViewportService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CanvasViewportService] });
    svc = TestBed.inject(CanvasViewportService);
    svc.init(1);
  });

  it('starts at scale=1, panX=0, panY=0', () => {
    expect(svc.scale()).toBe(1);
    expect(svc.panX()).toBe(0);
    expect(svc.panY()).toBe(0);
  });

  describe('computeFit', () => {
    it('centers the bounding box in the viewport', () => {
      svc.computeFit({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, 200, 100, 0);
      // fit = min(200/100, 100/50) = min(2, 2) = 2
      expect(svc.scale()).toBeCloseTo(2);
      expect(svc.fitScale()).toBeCloseTo(2);
      // panX = (200 - 100*2)/2 - 0*2 = 0
      expect(svc.panX()).toBeCloseTo(0);
      // panY = (100 - 50*2)/2 - 0*2 = 0
      expect(svc.panY()).toBeCloseTo(0);
    });

    it('applies margin correctly', () => {
      svc.computeFit({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 120, 120, 10);
      // fit = (120-20)/100 = 1
      expect(svc.scale()).toBeCloseTo(1);
    });
  });

  describe('zoomAt', () => {
    beforeEach(() => svc.computeFit({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 200, 200, 0));

    it('increases scale when zooming in', () => {
      const before = svc.scale();
      svc.zoomAt(2, 100, 100);
      expect(svc.scale()).toBeCloseTo(before * 2);
    });

    it('preserves the anchor point position after zoom', () => {
      // Before zoom: canvas coords at screen point (50,50)
      const anchorX = 50, anchorY = 50;
      const canvasXBefore = (anchorX - svc.panX()) / svc.scale();
      const canvasYBefore = (anchorY - svc.panY()) / svc.scale();
      svc.zoomAt(2, anchorX, anchorY);
      // After zoom: same canvas point should project to same screen point
      const canvasXAfter = (anchorX - svc.panX()) / svc.scale();
      const canvasYAfter = (anchorY - svc.panY()) / svc.scale();
      expect(canvasXAfter).toBeCloseTo(canvasXBefore, 5);
      expect(canvasYAfter).toBeCloseTo(canvasYBefore, 5);
    });

    it('clamps scale to fitScale*0.5 minimum', () => {
      const fit = svc.fitScale();
      svc.zoomAt(0.001, 0, 0);
      expect(svc.scale()).toBeCloseTo(fit * 0.5);
    });

    it('clamps scale to fitScale*50 maximum', () => {
      const fit = svc.fitScale();
      svc.zoomAt(1000, 0, 0);
      expect(svc.scale()).toBeCloseTo(fit * 50);
    });
  });

  describe('pan', () => {
    it('shifts panX and panY', () => {
      svc.pan(10, -5);
      expect(svc.panX()).toBe(10);
      expect(svc.panY()).toBe(-5);
      svc.pan(3, 2);
      expect(svc.panX()).toBe(13);
      expect(svc.panY()).toBe(-3);
    });
  });

  describe('zoomReadout', () => {
    it('shows ×1.00 at fit scale', () => {
      svc.computeFit({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 200, 200, 0);
      expect(svc.zoomReadout()).toBe('×1.00');
    });
  });
});
