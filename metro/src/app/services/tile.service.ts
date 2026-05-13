import { Injectable } from '@angular/core';

import { LruCache } from '../utils/lru-cache';
import { canvasToLonLat, lonLatToCanvas, tileToLonLat, lonLatToTile } from '../utils/projection';

const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

@Injectable({ providedIn: 'root' })
export class TileService {
  private readonly cache = new LruCache<string, HTMLImageElement>(128);

  zoomFor(scale: number): number {
    if (scale < 0.3) return 12;
    if (scale < 0.7) return 13;
    if (scale < 1.5) return 14;
    if (scale < 3.0) return 15;
    return 16;
  }

  getTile(z: number, tx: number, ty: number, onLoad: () => void): HTMLImageElement | null {
    const key = `${z}/${ty}/${tx}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const img        = new Image();
    img.crossOrigin  = 'anonymous';
    img.src          = `${TILE_URL}/${z}/${ty}/${tx}`;
    img.onload       = onLoad;
    this.cache.set(key, img);
    return null;
  }

  drawTiles(
    ctx: CanvasRenderingContext2D,
    scale: number, panX: number, panY: number,
    dpr: number,
    onLoad: () => void,
  ): void {
    const z  = this.zoomFor(scale);
    const cw = ctx.canvas.width  / dpr;
    const ch = ctx.canvas.height / dpr;

    const toCanvas = (sx: number, sy: number) => [
      (sx - panX) / scale,
      (sy - panY) / scale,
    ] as [number, number];

    const [cx0, cy0] = toCanvas(0,  0);
    const [cx1, cy1] = toCanvas(cw, ch);

    const { lon: lon0, lat: lat0 } = canvasToLonLat(cx0, cy0);
    const { lon: lon1, lat: lat1 } = canvasToLonLat(cx1, cy1);

    const { tx: txMin, ty: tyMin } = lonLatToTile(lon0, lat0, z);
    const { tx: txMax, ty: tyMax } = lonLatToTile(lon1, lat1, z);

    for (let ty = tyMin; ty <= tyMax + 1; ty++) {
      for (let tx = txMin; tx <= txMax + 1; tx++) {
        const { lon: lonTL, lat: latTL } = tileToLonLat(tx,     ty,     z);
        const { lon: lonBR, lat: latBR } = tileToLonLat(tx + 1, ty + 1, z);
        const { x: cx,  y: cy  }        = lonLatToCanvas(lonTL, latTL);
        const { x: cxe, y: cye }        = lonLatToCanvas(lonBR, latBR);
        const tw = cxe - cx;
        const th = cye - cy;
        if (tw <= 0 || th <= 0) continue;

        const img = this.getTile(z, tx, ty, onLoad);
        if (img?.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, cx, cy, tw, th);
        }
      }
    }
  }
}
