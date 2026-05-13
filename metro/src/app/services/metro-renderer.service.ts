import { Injectable, inject } from '@angular/core';

import { Train } from '../train';
import { TrackedPerson } from './simulation-state.service';
import { MetroDataService } from './metro-data.service';
import { SimulationConfigService } from './simulation-config.service';
import { CanvasViewportService } from './canvas-viewport.service';
import { PathGeometryService } from './path-geometry.service';
import { lineColor } from '../utils/format';
import { positionAtArc } from '../utils/path-geometry';
import { TRAIN_WAGONS, DEFAULT_WAGONS, WAGON_W, WAGON_H, WAGON_GAP } from '../constants';

const PATH_WIDTH_PX      = 6;
const DOT_RADIUS_PX      = 5;
const DOT_STROKE_PX      = 1.2;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

@Injectable()
export class MetroRendererService {
  private readonly viewport = inject(CanvasViewportService);
  private readonly metroData = inject(MetroDataService);
  private readonly pathGeo   = inject(PathGeometryService);
  private readonly cfg       = inject(SimulationConfigService);

  drawPaths(ctx: CanvasRenderingContext2D): void {
    this.viewport.clearCtx(ctx);
    this.viewport.applyTransform(ctx);

    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    const scale  = this.viewport.scale();

    ctx.globalAlpha = 0.18;
    for (const seg of this.metroData.paths) {
      if (seg.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(seg.path[0].x, seg.path[0].y);
      for (const p of seg.path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = lineColor(seg.line);
      ctx.lineWidth   = (PATH_WIDTH_PX * 2) / scale;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.lineWidth = PATH_WIDTH_PX / scale;
    for (const seg of this.metroData.paths) {
      if (seg.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(seg.path[0].x, seg.path[0].y);
      for (const p of seg.path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = lineColor(seg.line);
      ctx.stroke();
    }
  }

  drawStations(ctx: CanvasRenderingContext2D): void {
    this.viewport.clearCtx(ctx);
    this.viewport.applyTransform(ctx);
    const scale = this.viewport.scale();
    const r  = DOT_RADIUS_PX / scale;
    const lw = DOT_STROKE_PX / scale;
    ctx.lineWidth = lw;
    for (const station of this.metroData.stations) {
      const { x, y } = station.position;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle   = '#0c0e11';
      ctx.fill();
      ctx.strokeStyle = '#e6ebf2';
      ctx.stroke();
      ctx.closePath();
    }
  }

  drawTrains(
    ctx:      CanvasRenderingContext2D,
    trains:   Train[],
    now:      number,
    hovered:  string | null,
    selected: string | null,
    tracked:  TrackedPerson | null,
  ): void {
    this.viewport.clearCtx(ctx);
    this.viewport.applyTransform(ctx);

    const scale    = this.viewport.scale();
    const fitScale = this.viewport.fitScale();

    const capRatio      = PATH_WIDTH_PX * 1.4 / (WAGON_H * fitScale * 3.11);
    const rawRatio      = PATH_WIDTH_PX * 1.4 / (WAGON_H * scale);
    const trainSizeRatio = Math.max(1.0, Math.min(rawRatio, capRatio));

    for (const train of trains) {
      const wagons    = TRAIN_WAGONS[train.line] ?? DEFAULT_WAGONS;
      const stride    = WAGON_W + WAGON_GAP;
      const halfLen   = (wagons - 1) / 2 * stride;
      const effStride = stride  * trainSizeRatio;
      const effHalf   = halfLen * trainSizeRatio;
      const occ       = train.capacity > 0 ? Math.min(1, train.people / train.capacity) : 0;
      const fillClr   = occ < 0.5 ? '#4ade80' : occ < 0.8 ? '#fbbf24' : '#f87171';
      const lineClr   = lineColor(train.line);
      const r         = WAGON_H * 0.3;
      const inset     = 0.25;

      const hasPath = train.pathPoints.length >= 2 && train.pathArcLens.length >= 2;

      let centerArc = 0;
      let centerSegIdx = 1;
      if (hasPath) {
        const segStart  = train.pathSegStart;
        const segEnd    = train.pathSegEnd;
        const lensTotal = train.pathArcLens[train.pathArcLens.length - 1];
        if (train.travelMs > 0) {
          const t    = Math.min(1, (now - train.departedAt) / train.travelMs);
          const ease = t * t * (3 - 2 * t);
          centerArc  = segStart + ease * (segEnd - segStart);
        } else {
          centerArc = segEnd;
        }
        centerArc = Math.max(effHalf, Math.min(lensTotal - effHalf, centerArc));
        const c = positionAtArc(train.pathPoints, train.pathArcLens, centerArc);
        train.x = c.x; train.y = c.y; train.heading = c.heading;
        centerSegIdx = c.segIdx;
      } else if (train.travelMs > 0) {
        const t    = Math.min(1, (now - train.departedAt) / train.travelMs);
        const ease = t * t * (3 - 2 * t);
        train.x = train.fromX + (train.targetX - train.fromX) * ease;
        train.y = train.fromY + (train.targetY - train.fromY) * ease;
      }

      for (let i = wagons - 1; i >= 0; i--) {
        const arcOffset = (i - (wagons - 1) / 2) * effStride;
        let wx: number, wy: number, wh: number;
        if (hasPath) {
          const p = positionAtArc(train.pathPoints, train.pathArcLens, centerArc + arcOffset, centerSegIdx);
          wx = p.x; wy = p.y; wh = p.heading;
        } else {
          wx = train.x; wy = train.y; wh = train.heading;
        }

        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wh);
        ctx.scale(trainSizeRatio, trainSizeRatio);

        roundedRect(ctx, -WAGON_W / 2, -WAGON_H / 2, WAGON_W, WAGON_H, r);
        ctx.fillStyle = '#11141a'; ctx.fill();

        roundedRect(ctx, -WAGON_W / 2 + inset, -WAGON_H / 2 + inset, WAGON_W - inset * 2, WAGON_H - inset * 2, r * 0.5);
        ctx.fillStyle = fillClr; ctx.fill();

        roundedRect(ctx, -WAGON_W / 2, -WAGON_H / 2, WAGON_W, WAGON_H, r);
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 0.60; ctx.stroke();

        roundedRect(ctx, -WAGON_W / 2, -WAGON_H / 2, WAGON_W, WAGON_H, r);
        ctx.strokeStyle = lineClr; ctx.lineWidth = 0.25; ctx.stroke();

        ctx.restore();
      }

      // Direction arrow
      const arrowH   = WAGON_H * 0.8;
      const arrowArc = centerArc + trainSizeRatio * (halfLen + WAGON_W / 2 + arrowH);
      let ax: number, ay: number, ah: number;
      if (hasPath) {
        const ap = positionAtArc(train.pathPoints, train.pathArcLens, arrowArc, centerSegIdx);
        ax = ap.x; ay = ap.y; ah = ap.heading;
      } else {
        ax = train.x + Math.cos(train.heading) * trainSizeRatio * (halfLen + WAGON_W / 2 + arrowH);
        ay = train.y + Math.sin(train.heading) * trainSizeRatio * (halfLen + WAGON_W / 2 + arrowH);
        ah = train.heading;
      }
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(ah); ctx.scale(trainSizeRatio, trainSizeRatio);
      ctx.beginPath();
      ctx.moveTo(arrowH, 0); ctx.lineTo(0, -arrowH * 0.6); ctx.lineTo(0, arrowH * 0.6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.restore();
    }

    // Hover ring
    if (hovered && hovered !== selected) {
      const ht = trains.find(t => t.id === hovered);
      if (ht) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ht.x, ht.y, (WAGON_H * 1.8) / scale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth   = 1.5 / scale;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Selected ring
    if (selected) {
      const st = trains.find(t => t.id === selected);
      if (st) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(st.x, st.y, (WAGON_H * 1.8) / scale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245,180,84,0.85)';
        ctx.lineWidth   = 2 / scale;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Tracked person route
    if (tracked?.id) {
      const railPoints = this.pathGeo.buildPersonRailPath(tracked.nodes);
      if (railPoints.length >= 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(railPoints[0].x, railPoints[0].y);
        for (const p of railPoints.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(239,68,68,0.75)';
        ctx.lineWidth   = 4 / scale;
        ctx.setLineDash([7 / scale, 5 / scale]);
        ctx.stroke();
        ctx.restore();
      }
      const locPos = this.pathGeo.resolveLocToPos(tracked);
      if (locPos) {
        const r = 7 / scale;
        ctx.save();
        ctx.fillStyle   = '#ef4444';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 1.2 / scale;
        ctx.beginPath();
        ctx.arc(locPos.x, locPos.y - r * 1.05, r * 0.52, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(locPos.x, locPos.y + r * 0.75, r, Math.PI, 0);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }
}
