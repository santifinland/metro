import { Injectable, signal, computed } from '@angular/core';

@Injectable()
export class CanvasViewportService {
  private readonly _scale    = signal(1);
  private readonly _fitScale = signal(1);
  private readonly _panX     = signal(0);
  private readonly _panY     = signal(0);

  readonly scale    = this._scale.asReadonly();
  readonly fitScale = this._fitScale.asReadonly();
  readonly panX     = this._panX.asReadonly();
  readonly panY     = this._panY.asReadonly();
  readonly zoomReadout = computed(() =>
    `×${(this._scale() / this._fitScale()).toFixed(2)}`
  );

  private _dpr = 1;

  init(dpr: number): void { this._dpr = dpr; }

  computeFit(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    vW: number, vH: number,
    margin = 40,
  ): void {
    const netW = bounds.maxX - bounds.minX;
    const netH = bounds.maxY - bounds.minY;
    const fit  = Math.min((vW - margin * 2) / netW, (vH - margin * 2) / netH);
    this._fitScale.set(fit);
    this._scale.set(fit);
    this._panX.set((vW - netW * fit) / 2 - bounds.minX * fit);
    this._panY.set((vH - netH * fit) / 2 - bounds.minY * fit);
  }

  zoomAt(factor: number, anchorX: number, anchorY: number): void {
    const fit      = this._fitScale();
    const s        = this._scale();
    const newScale = Math.max(fit * 0.5, Math.min(fit * 50, s * factor));
    const actual   = newScale / s;
    this._panX.update(p => anchorX + (p - anchorX) * actual);
    this._panY.update(p => anchorY + (p - anchorY) * actual);
    this._scale.set(newScale);
  }

  pan(dx: number, dy: number): void {
    this._panX.update(p => p + dx);
    this._panY.update(p => p + dy);
  }

  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(
      this._scale() * this._dpr, 0,
      0, this._scale() * this._dpr,
      this._panX() * this._dpr,
      this._panY() * this._dpr,
    );
  }

  clearCtx(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
