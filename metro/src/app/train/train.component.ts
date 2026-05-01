import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { WebSocketService } from '../services/websocket.service';
import { MetroDataService } from '../services/metro-data.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { SimulationConfigService } from '../services/simulation-config.service';
import { LINE_COLORS, TRAIN_WAGONS, DEFAULT_WAGONS, WAGON_W, WAGON_H, WAGON_GAP } from '../constants';

@Component({
  selector: 'app-train',
  standalone: true,
  imports: [],
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css']
})
export class TrainComponent implements AfterViewInit, OnDestroy, OnInit {

  @ViewChild('canvasContainer', { static: false, read: ElementRef }) canvasContainer!: ElementRef;
  @ViewChild('canvas_tiles',    { static: false, read: ElementRef }) canvasTiles!: ElementRef;
  @ViewChild('canvas_stations', { static: false, read: ElementRef }) canvasStations!: ElementRef;
  @ViewChild('canvas_paths',    { static: false, read: ElementRef }) canvasPaths!: ElementRef;
  @ViewChild('canvas_trains',   { static: false, read: ElementRef }) canvasTrains!: ElementRef;
  @ViewChild('stationsOverlay', { static: false, read: ElementRef }) private stationsOverlay!: ElementRef;
  private _overlayElements: HTMLElement[] | null = null;
  private selectedStationIdx  = -1;
  private _lastSelectedIdx    = -2;
  private _hoveredStationIdx  = -1;
  private _lastHoveredIdx     = -2;
  private _mouseContainerX    = -1;
  private _mouseContainerY    = -1;
  showAllPanels = false;

  private ctxTiles!: CanvasRenderingContext2D;
  private ctxStations!: CanvasRenderingContext2D;
  private ctxPaths!: CanvasRenderingContext2D;
  private ctxTrains!: CanvasRenderingContext2D;

  showSatellite = false;
  private readonly tileCache = new Map<string, HTMLImageElement>();

  // Projection constants matching Position.ts
  private readonly LAMBDA0 =  -3.718762;
  private readonly PHI0    =  40.4202961;   // degrees — used in y formula
  private readonly RADIUS  =  6371;
  private readonly COS_P1  = Math.cos(40.4202961); // phi1 treated as radians in Position.ts
  private readonly CW      = 3400;
  private readonly CH      = 2000;

  leftCollapsed  = false;
  rightCollapsed = false;

  currentScale = 1;
  protected fitScale  = 1;
  readonly isDev = !environment.production;

  private panX = 0;
  private panY = 0;

  private readonly dpr = window.devicePixelRatio || 1;

  private time = 6 * 3600 * 1000;
  private clockSynced = false;
  private lastRafTimestamp = 0;
  private lastCdTick = 0;
  private rafId = 0;
  private needsStaticRedraw = false;
  private needsTrainRedraw  = false;
  private readonly destroy$ = new Subject<void>();
  private destroyed = false;

  static readonly SPEED_PRESETS = [0.25, 0.5, 1, 2, 5, 10, 20];
  private speedIdx = 2;
  get localSpeed(): number { return TrainComponent.SPEED_PRESETS[this.speedIdx]; }
  get speedPresets(): number[] { return TrainComponent.SPEED_PRESETS; }
  get speedIdx_(): number { return this.speedIdx; }

  resetTime = '06:05';

  private labelVisible: boolean[] = [];
  private stationLineMap = new Map<string, string[]>();

  // Sparkline history
  peopleHistory: number[] = Array(40).fill(0);

  private static readonly PATH_WIDTH_PX      = 6;
  private static readonly DOT_RADIUS_PX      = 5;
  private static readonly DOT_STROKE_PX      = 1.2;
  private static readonly LABEL_SIZE_PX      = 11;
  private static readonly LABEL_SIZE_ZOOM_PX = 13;
  private static readonly LABEL_SHOW_ALL_MUL = 2.5;

  constructor(
    private readonly wsService: WebSocketService,
    private readonly ngZone: NgZone,
    private readonly cd: ChangeDetectorRef,
    readonly metroData: MetroDataService,
    readonly state: SimulationStateService,
    readonly cfg: SimulationConfigService,
  ) {
    const lines = new Set(this.metroData.paths.map(p => p.line));
    this.state.initLines(Array.from(lines));
  }

  ngOnInit(): void {
    this.buildStationLineMap();
  }

  ngAfterViewInit(): void {
    this.resizeCanvases();

    this.ctxTiles    = this.canvasTiles.nativeElement.getContext('2d')!;
    this.ctxStations = this.canvasStations.nativeElement.getContext('2d')!;
    this.ctxPaths    = this.canvasPaths.nativeElement.getContext('2d')!;
    this.ctxTrains   = this.canvasTrains.nativeElement.getContext('2d')!;

    this.computeFit();
    this.computeLabelVisibility();
    this.setupEvents();

    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;

    this.wsService.send({ message: 'setSpeed', factor: this.localSpeed });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => {
        if (msg.message === 'simTime') {
          const drift = Math.abs(this.time - msg.ms);
          if (!this.clockSynced || drift > 5_000) {
            this.time = msg.ms;
            this.clockSynced = true;
          }
        }
        if (msg.message === 'reset') {
          const [h, m] = this.resetTime.split(':').map(Number);
          this.time = ((h || 6) * 3600 + (m || 0)) * 1000;
          this.clockSynced = false;
          this.state.reset();
        }
        this.state.process(msg);
        // Resolve track geometry for path-following animation
        if ((msg.message === 'newTrain' || msg.message === 'moveTrain') && msg.anden != null) {
          const train = this.state.getTrain(msg.train);
          if (train) {
            const seg = this.metroData.paths.find(s => s.id === String(msg.anden));
            if (seg && seg.path.length >= 2) {
              const { path, segStart, segEnd } = this.buildCompositePath(seg);
              train.pathPoints    = path;
              train.pathArcLens   = this.computeArcLens(path);
              train.pathSegStart  = segStart;
              train.pathSegEnd    = segEnd;
              train.line = seg.line;
              const last = path[path.length - 1];
              const prev = path[path.length - 2];
              train.heading = Math.atan2(last.y - prev.y, last.x - prev.x);
            }
          }
        }
        this.cd.markForCheck();
      });

    this.ngZone.runOutsideAngular(() => this.startRenderLoop());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Canvas sizing ────────────────────────────────────────────

  private resizeCanvases(): void {
    const el = this.canvasContainer.nativeElement as HTMLElement;
    const W  = el.clientWidth;
    const H  = el.clientHeight;
    for (const ref of [this.canvasTiles, this.canvasPaths, this.canvasStations, this.canvasTrains]) {
      const c = ref.nativeElement as HTMLCanvasElement;
      c.width  = W * this.dpr;
      c.height = H * this.dpr;
      c.style.width  = `${W}px`;
      c.style.height = `${H}px`;
    }
  }

  // ── Fit computation ──────────────────────────────────────────

  private computeFit(): void {
    const container = this.canvasContainer.nativeElement as HTMLElement;
    const vW = container.clientWidth;
    const vH = container.clientHeight;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.metroData.paths) {
      for (const p of s.path) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    const margin = 40;
    const netW   = maxX - minX;
    const netH   = maxY - minY;
    this.fitScale    = Math.min((vW - margin * 2) / netW, (vH - margin * 2) / netH);
    this.currentScale = this.fitScale;
    this.panX = (vW - netW * this.fitScale) / 2 - minX * this.fitScale;
    this.panY = (vH - netH * this.fitScale) / 2 - minY * this.fitScale;
  }

  // ── Transform helpers ────────────────────────────────────────

  private applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(
      this.currentScale * this.dpr, 0,
      0, this.currentScale * this.dpr,
      this.panX * this.dpr,
      this.panY * this.dpr,
    );
  }

  private clearCtx(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // ── Events ───────────────────────────────────────────────────

  private setupEvents(): void {
    const container = this.canvasContainer.nativeElement as HTMLElement;

    container.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const factor    = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale  = Math.max(
        this.fitScale * 0.5,
        Math.min(this.fitScale * 50, this.currentScale * factor),
      );
      const actual = newScale / this.currentScale;
      this.panX = e.clientX + (this.panX - e.clientX) * actual;
      this.panY = e.clientY + (this.panY - e.clientY) * actual;
      this.currentScale = newScale;
      this.needsStaticRedraw = true;
      this.needsTrainRedraw  = true;
    }, { passive: false });

    let dragging = false;
    let mouseMoved = false;
    let lastX = 0, lastY = 0;
    container.addEventListener('mousedown', (e: MouseEvent) => {
      dragging = true; mouseMoved = false;
      lastX = e.clientX; lastY = e.clientY;
      container.style.cursor = 'grabbing';
    });
    container.addEventListener('mousemove', (e: MouseEvent) => {
      // Track container-relative mouse position for hover detection in RAF
      const rect = container.getBoundingClientRect();
      this._mouseContainerX = e.clientX - rect.left;
      this._mouseContainerY = e.clientY - rect.top;

      if (!dragging) {
        // Show pointer cursor when over a clickable station dot
        const near = this.findNearestStation(this._mouseContainerX, this._mouseContainerY, 14);
        container.style.cursor = near >= 0 ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (dx * dx + dy * dy > 64) mouseMoved = true;  // 8px threshold
      this.panX += dx;
      this.panY += dy;
      lastX = e.clientX; lastY = e.clientY;
      this.needsStaticRedraw = true;
      this.needsTrainRedraw  = true;
    });
    const endDrag = () => {
      dragging = false;
      const near = this.findNearestStation(this._mouseContainerX, this._mouseContainerY, 14);
      container.style.cursor = near >= 0 ? 'pointer' : 'grab';
    };
    container.addEventListener('mouseup', (e: MouseEvent) => {
      if (dragging && !mouseMoved) this.handleMapClick(e.clientX, e.clientY);
      endDrag();
    });
    container.addEventListener('mouseleave', () => {
      dragging = false;
      this._mouseContainerX = -1;
      this._mouseContainerY = -1;
      container.style.cursor = 'grab';
    });

    window.addEventListener('resize', () => {
      this.resizeCanvases();
      this.needsStaticRedraw = true;
      this.needsTrainRedraw  = true;
    });
  }

  // ── Zoom controls ────────────────────────────────────────────

  zoomIn(): void  { this.zoomAroundCenter(1.3); }
  zoomOut(): void { this.zoomAroundCenter(1 / 1.3); }

  zoomReset(): void {
    this.computeFit();
    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;
  }

  private zoomAroundCenter(factor: number): void {
    const el = this.canvasContainer.nativeElement as HTMLElement;
    const cx = el.clientWidth  / 2;
    const cy = el.clientHeight / 2;
    const newScale = Math.max(
      this.fitScale * 0.5,
      Math.min(this.fitScale * 50, this.currentScale * factor),
    );
    const actual = newScale / this.currentScale;
    this.panX = cx + (this.panX - cx) * actual;
    this.panY = cy + (this.panY - cy) * actual;
    this.currentScale = newScale;
    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;
  }

  // ── Render loop ──────────────────────────────────────────────

  private startRenderLoop(): void {
    const loop = (timestamp: number) => {
      if (this.destroyed) return;

      const dt = this.lastRafTimestamp > 0 ? timestamp - this.lastRafTimestamp : 0;
      this.lastRafTimestamp = timestamp;
      if (!this.state.paused) {
        this.time += dt * this.localSpeed;
      }

      if (this.needsStaticRedraw) {
        this.drawTiles();
        this.drawPaths();
        this.drawStations();
        this.needsStaticRedraw = false;
      }

      this.drawTrains(timestamp);
      this.updateStationsOverlay();
      this.state.dirty      = false;
      this.needsTrainRedraw = false;

      if (timestamp - this.lastCdTick >= 200) {
        this.lastCdTick = timestamp;
        this.peopleHistory = [...this.peopleHistory.slice(1), this.state.metroPeople];
        this.ngZone.run(() => {});
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // ── Label size ───────────────────────────────────────────────

  private static readonly LABEL_ZOOM_HIGH = 5.0;

  private labelTargetPx(): number {
    const mul  = this.currentScale / this.fitScale;
    const low  = TrainComponent.LABEL_SHOW_ALL_MUL;
    const high = TrainComponent.LABEL_ZOOM_HIGH;
    if (mul <= low)  return TrainComponent.LABEL_SIZE_PX;
    if (mul >= high) return TrainComponent.LABEL_SIZE_ZOOM_PX;
    const t = (mul - low) / (high - low);
    return TrainComponent.LABEL_SIZE_PX + t * (TrainComponent.LABEL_SIZE_ZOOM_PX - TrainComponent.LABEL_SIZE_PX);
  }

  // ── Drawing ──────────────────────────────────────────────────

  private drawPaths(): void {
    const ctx = this.ctxPaths;
    this.clearCtx(ctx);
    this.applyTransform(ctx);

    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // Glow pass
    ctx.globalAlpha = 0.18;
    for (const segment of this.metroData.paths) {
      if (segment.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(segment.path[0].x, segment.path[0].y);
      for (const p of segment.path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = this.lineColors(segment.line);
      ctx.lineWidth = (TrainComponent.PATH_WIDTH_PX * 2) / this.currentScale;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Main stroke
    ctx.lineWidth = TrainComponent.PATH_WIDTH_PX / this.currentScale;
    for (const segment of this.metroData.paths) {
      if (segment.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(segment.path[0].x, segment.path[0].y);
      for (const p of segment.path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = this.lineColors(segment.line);
      ctx.stroke();
    }
  }

  private computeLabelVisibility(): void {
    const scale   = this.fitScale;
    const fontSize = Math.round(TrainComponent.LABEL_SIZE_PX / scale);
    this.ctxStations.font = `${fontSize}px 'JetBrains Mono', monospace`;
    const r       = TrainComponent.DOT_RADIUS_PX / scale;
    const padding = 2 / scale;
    const placed: { x: number; y: number; w: number; h: number }[] = [];

    this.labelVisible = this.metroData.stations.map(station => {
      const { x, y } = station.position;
      const lx = x + r + padding;
      const ly = y + fontSize * 0.35;
      const bw = this.ctxStations.measureText(station.name).width + padding * 2;
      const bh = fontSize * 1.1;
      const bx = lx - padding;
      const by = ly - fontSize * 0.85;
      const overlaps = placed.some(p =>
        bx < p.x + p.w && bx + bw > p.x && by < p.y + p.h && by + bh > p.y,
      );
      if (!overlaps) placed.push({ x: bx, y: by, w: bw, h: bh });
      return !overlaps;
    });
  }

  private findNearestStation(cx: number, cy: number, hitPx = 14): number {
    let bestIdx = -1, bestDist = hitPx * hitPx;
    this.metroData.stations.forEach((s, i) => {
      const sx = s.position.x * this.currentScale + this.panX;
      const sy = s.position.y * this.currentScale + this.panY;
      const d2 = (cx - sx) ** 2 + (cy - sy) ** 2;
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; }
    });
    return bestIdx;
  }

  onStationLabelClick(idx: number): void {
    this.selectedStationIdx = idx === this.selectedStationIdx ? -1 : idx;
  }

  private handleMapClick(clientX: number, clientY: number): void {
    const rect = (this.canvasContainer.nativeElement as HTMLElement).getBoundingClientRect();
    const bestIdx = this.findNearestStation(clientX - rect.left, clientY - rect.top);
    this.selectedStationIdx = bestIdx === this.selectedStationIdx ? -1 : bestIdx;
  }

  private updateStationsOverlay(): void {
    const el = this.stationsOverlay?.nativeElement as HTMLElement | undefined;
    if (!el) return;
    const fitMul = this.currentScale / this.fitScale;
    el.classList.toggle('show-interchange', fitMul > 1.05);
    el.classList.toggle('show-all',         fitMul > 1.7);
    el.classList.toggle('show-panel',       fitMul > 15 || this.showAllPanels);
    el.classList.toggle('zoom-deep',        fitMul > 7);
    if (!this._overlayElements) {
      const items = el.querySelectorAll<HTMLElement>('.stn-label-wrap');
      if (items.length > 0) this._overlayElements = Array.from(items);
    }
    if (this._overlayElements) {
      const stations = this.metroData.stations;
      const s = this.currentScale, px = this.panX, py = this.panY;
      for (let i = 0; i < this._overlayElements.length; i++) {
        const st = stations[i];
        if (!st) continue;
        this._overlayElements[i].style.left = (st.position.x * s + px) + 'px';
        this._overlayElements[i].style.top  = (st.position.y * s + py) + 'px';
      }
      // Sync selected class only when it changes
      if (this.selectedStationIdx !== this._lastSelectedIdx) {
        if (this._lastSelectedIdx >= 0) this._overlayElements[this._lastSelectedIdx]?.classList.remove('is-selected');
        if (this.selectedStationIdx >= 0) this._overlayElements[this.selectedStationIdx]?.classList.add('is-selected');
        this._lastSelectedIdx = this.selectedStationIdx;
      }
      // Sync hover class
      const hoverIdx = this.findNearestStation(this._mouseContainerX, this._mouseContainerY, 14);
      if (hoverIdx !== this._lastHoveredIdx) {
        if (this._lastHoveredIdx >= 0) this._overlayElements[this._lastHoveredIdx]?.classList.remove('is-hover');
        if (hoverIdx >= 0) this._overlayElements[hoverIdx]?.classList.add('is-hover');
        this._hoveredStationIdx = hoverIdx;
        this._lastHoveredIdx = hoverIdx;
      }
    }
  }

  private buildStationLineMap(): void {
    this.stationLineMap.clear();
    // Deduplicate by line+sentido so bidirectional lines (e.g. L5 with sentido 1 & 2)
    // appear as two entries — same as L6 which has distinct line IDs '6-1' / '6-2'.
    const seen = new Map<string, Set<string>>();
    for (const p of this.metroData.paths) {
      const dirKey = p.line + '/' + (p.sentido ?? '');
      if (!seen.has(p.name)) seen.set(p.name, new Set());
      if (!seen.get(p.name)!.has(dirKey)) {
        seen.get(p.name)!.add(dirKey);
        const lines = this.stationLineMap.get(p.name) ?? [];
        lines.push(p.line);
        this.stationLineMap.set(p.name, lines);
      }
    }
  }

  private drawStations(): void {
    const ctx   = this.ctxStations;
    const scale = this.currentScale;
    this.clearCtx(ctx);
    this.applyTransform(ctx);
    const r  = TrainComponent.DOT_RADIUS_PX / scale;
    const lw = TrainComponent.DOT_STROKE_PX / scale;
    ctx.lineWidth = lw;
    this.metroData.stations.forEach(station => {
      const { x, y } = station.position;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle   = '#0c0e11';
      ctx.fill();
      ctx.strokeStyle = '#e6ebf2';
      ctx.stroke();
      ctx.closePath();
    });
  }

  private drawTrains(now: number): void {
    const ctx = this.ctxTrains;
    this.clearCtx(ctx);
    this.applyTransform(ctx);

    // Scale wagons up at low zoom, capped at the size they have at fitMul=3.11 (empirically clean).
    const capRatio      = TrainComponent.PATH_WIDTH_PX * 1.4 / (WAGON_H * this.fitScale * 3.11);
    const rawRatio      = TrainComponent.PATH_WIDTH_PX * 1.4 / (WAGON_H * this.currentScale);
    const trainSizeRatio = Math.max(1.0, Math.min(rawRatio, capRatio));

    for (const train of this.state.trains) {
      const wagons    = TRAIN_WAGONS[train.line] ?? DEFAULT_WAGONS;
      const stride    = WAGON_W + WAGON_GAP;
      const halfLen   = (wagons - 1) / 2 * stride;
      const effStride = stride  * trainSizeRatio;
      const effHalf   = halfLen * trainSizeRatio;
      const occ       = train.capacity > 0 ? Math.min(1, train.people / train.capacity) : 0;
      const fillClr   = occ < 0.5 ? '#4ade80' : occ < 0.8 ? '#fbbf24' : '#f87171';
      const lineClr   = this.lineColors(train.line);
      const r         = WAGON_H * 0.3;
      const inset     = 0.25;

      const hasPath = train.pathPoints.length >= 2 && train.pathArcLens.length >= 2;

      // centerArc: arc position of the train's CENTRE on the composite path.
      // At rest the centre sits on the platform endpoint → train is centred on station.
      // Prepended tramos give rear wagons geometry; appended tramo gives nose + arrow room.
      // Clamp keeps all wagons on-path when a tramo has no neighbours (e.g. Line R).
      let centerArc = 0;
      if (hasPath) {
        const segStart  = train.pathSegStart;
        const segEnd    = train.pathSegEnd;
        const lensTotal = train.pathArcLens[train.pathArcLens.length - 1];
        if (train.travelMs > 0) {
          const t    = Math.min(1, (now - train.departedAt) / train.travelMs);
          const ease = t * t * (3 - 2 * t);
          centerArc = segStart + ease * (segEnd - segStart);
        } else {
          centerArc = segEnd;
        }
        // Clamp so rear wagon >= 0 and nose <= lensTotal
        centerArc = Math.max(effHalf, Math.min(lensTotal - effHalf, centerArc));
        const c = this.positionAtArc(train.pathPoints, train.pathArcLens, centerArc);
        train.x = c.x; train.y = c.y; train.heading = c.heading;
      } else if (train.travelMs > 0) {
        const t    = Math.min(1, (now - train.departedAt) / train.travelMs);
        const ease = t * t * (3 - 2 * t);
        train.x = train.fromX + (train.targetX - train.fromX) * ease;
        train.y = train.fromY + (train.targetY - train.fromY) * ease;
      }

      // Draw each wagon independently at its arc position (articulated through curves)
      for (let i = wagons - 1; i >= 0; i--) {
        const arcOffset = (i - (wagons - 1) / 2) * effStride;
        let wx: number, wy: number, wh: number;
        if (hasPath) {
          const p = this.positionAtArc(train.pathPoints, train.pathArcLens, centerArc + arcOffset);
          wx = p.x; wy = p.y; wh = p.heading;
        } else {
          wx = train.x; wy = train.y; wh = train.heading;
        }

        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wh);
        ctx.scale(trainSizeRatio, trainSizeRatio);

        this.roundedRect(ctx, -WAGON_W / 2, -WAGON_H / 2, WAGON_W, WAGON_H, r);
        ctx.fillStyle = '#11141a';
        ctx.fill();

        this.roundedRect(ctx,
          -WAGON_W / 2 + inset, -WAGON_H / 2 + inset,
          WAGON_W - inset * 2,   WAGON_H - inset * 2, r * 0.5);
        ctx.fillStyle = fillClr;
        ctx.fill();

        this.roundedRect(ctx, -WAGON_W / 2, -WAGON_H / 2, WAGON_W, WAGON_H, r);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth   = 0.60;
        ctx.stroke();

        this.roundedRect(ctx, -WAGON_W / 2, -WAGON_H / 2, WAGON_W, WAGON_H, r);
        ctx.strokeStyle = lineClr;
        ctx.lineWidth   = 0.25;
        ctx.stroke();

        ctx.restore();
      }

      // Direction arrow just ahead of the nose (nose = centerArc + effHalf)
      const arrowH   = WAGON_H * 0.8;
      const arrowArc = centerArc + trainSizeRatio * (halfLen + WAGON_W / 2 + arrowH);
      let ax: number, ay: number, ah: number;
      if (hasPath) {
        const ap = this.positionAtArc(train.pathPoints, train.pathArcLens, arrowArc);
        ax = ap.x; ay = ap.y; ah = ap.heading;
      } else {
        // Fallback: project nose in heading direction
        ax = train.x + Math.cos(train.heading) * trainSizeRatio * (halfLen + WAGON_W / 2 + arrowH);
        ay = train.y + Math.sin(train.heading) * trainSizeRatio * (halfLen + WAGON_W / 2 + arrowH);
        ah = train.heading;
      }
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ah);
      ctx.scale(trainSizeRatio, trainSizeRatio);
      ctx.beginPath();
      ctx.moveTo(arrowH,  0);
      ctx.lineTo(0,      -arrowH * 0.6);
      ctx.lineTo(0,       arrowH * 0.6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.restore();
    }
  }

  // Pre-compute cumulative arc lengths for a path (call once when path changes)
  private computeArcLens(pts: { x: number; y: number }[]): number[] {
    const lens: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      lens.push(lens[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    return lens;
  }

  // Return position + heading at a given arc-length along a path (clamps at endpoints).
  // With composite paths (prev + current tramo) clamping is rarely triggered.
  // ── Satellite tile map ───────────────────────────────────────

  toggleSatellite(): void {
    this.showSatellite = !this.showSatellite;
    this.needsStaticRedraw = true;
  }

  private tileZoom(): number {
    const s = this.currentScale;
    if (s < 0.3) return 12;
    if (s < 0.7) return 13;
    if (s < 1.5) return 14;
    if (s < 3.0) return 15;
    return 16;
  }

  // Canvas (x,y) → geographic (lon, lat)
  private canvasToLonLat(cx: number, cy: number): [number, number] {
    const lon = this.LAMBDA0 - (cx - this.CW / 2) / (this.RADIUS * this.COS_P1);
    const lat = this.PHI0   - (cy - this.CH / 2) / this.RADIUS;
    return [lon, lat];
  }

  // Geographic (lon, lat) → canvas (x, y)
  private lonLatToCanvas(lon: number, lat: number): [number, number] {
    const x = -this.RADIUS * (lon - this.LAMBDA0) * this.COS_P1 + this.CW / 2;
    const y = -this.RADIUS * (lat - this.PHI0)                   + this.CH / 2;
    return [x, y];
  }

  // Slippy-map tile top-left corner → geographic (lon, lat)
  private tileToLonLat(tx: number, ty: number, z: number): [number, number] {
    const n   = 2 ** z;
    const lon = tx / n * 360 - 180;
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI;
    return [lon, lat];
  }

  // Geographic (lon, lat) → slippy-map tile index
  private lonLatToTile(lon: number, lat: number, z: number): [number, number] {
    const n      = 2 ** z;
    const tx     = Math.floor((lon + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const ty     = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return [tx, ty];
  }

  private drawTiles(): void {
    this.clearCtx(this.ctxTiles);
    if (!this.showSatellite) return;

    const ctx = this.ctxTiles;
    this.applyTransform(ctx);

    const z  = this.tileZoom();
    const cw = ctx.canvas.width  / this.dpr;
    const ch = ctx.canvas.height / this.dpr;

    // Visible canvas-coordinate corners (inverse of applyTransform)
    const toCanvas = (sx: number, sy: number): [number, number] => [
      (sx - this.panX) / this.currentScale,
      (sy - this.panY) / this.currentScale,
    ];
    const [cx0, cy0] = toCanvas(0,  0);   // top-left  → high lat, small lon
    const [cx1, cy1] = toCanvas(cw, ch);  // bot-right → low lat,  large lon

    const [lon0, lat0] = this.canvasToLonLat(cx0, cy0);
    const [lon1, lat1] = this.canvasToLonLat(cx1, cy1);

    const [txMin, tyMin] = this.lonLatToTile(lon0, lat0, z);  // NW corner → small ty
    const [txMax, tyMax] = this.lonLatToTile(lon1, lat1, z);  // SE corner → large ty

    for (let ty = tyMin; ty <= tyMax + 1; ty++) {
      for (let tx = txMin; tx <= txMax + 1; tx++) {
        const [lonTL, latTL] = this.tileToLonLat(tx,     ty,     z);
        const [lonBR, latBR] = this.tileToLonLat(tx + 1, ty + 1, z);
        const [cx,  cy ]     = this.lonLatToCanvas(lonTL, latTL);
        const [cxe, cye]     = this.lonLatToCanvas(lonBR, latBR);
        const tw = cxe - cx;
        const th = cye - cy;
        if (tw <= 0 || th <= 0) continue;

        const key = `${z}/${ty}/${tx}`;
        const img = this.tileCache.get(key);
        if (img?.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, cx, cy, tw, th);
        } else if (!img) {
          if (this.tileCache.size > 300) {
            // Evict oldest entry to bound memory
            this.tileCache.delete(this.tileCache.keys().next().value!);
          }
          const image        = new Image();
          image.crossOrigin  = 'anonymous';
          image.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
          image.onload = () => { this.needsStaticRedraw = true; };
          this.tileCache.set(key, image);
        }
      }
    }
  }

  private positionAtArc(
    pts:  { x: number; y: number }[],
    lens: number[],
    arc:  number,
  ): { x: number; y: number; heading: number } {
    const total   = lens[lens.length - 1];
    const clamped = Math.max(0, Math.min(total, arc));

    let i = 1;
    while (i < lens.length - 1 && lens[i] < clamped) i++;

    const p0     = pts[i - 1];
    const p1     = pts[i];
    const segLen = lens[i] - lens[i - 1];
    const segT   = segLen > 0 ? (clamped - lens[i - 1]) / segLen : 0;

    return {
      x:       p0.x + (p1.x - p0.x) * segT,
      y:       p0.y + (p1.y - p0.y) * segT,
      heading: Math.atan2(p1.y - p0.y, p1.x - p0.x),
    };
  }

  // Build a composite path: up to 2 previous tramos + current tramo + 1 next tramo.
  // Returns the path and the arc positions of the current tramo's start and end,
  // so drawTrains can anchor the train nose at segEnd without clamping issues.
  private buildCompositePath(
    seg: { id: string; line: string; sentido: string; path: { x: number; y: number }[] },
  ): { path: { x: number; y: number }[]; segStart: number; segEnd: number } {
    const CONNECT_SQ = 4;  // ≈ 2 canvas-unit junction tolerance
    const usedIds = new Set<string>([seg.id]);

    // ── Prepend up to 2 previous tramos (rear-wagon room) ──────────────────
    let prepended: { x: number; y: number }[] = [];
    let searchFrom = seg.path[0];
    for (let k = 0; k < 2; k++) {
      let best = CONNECT_SQ, prev: typeof seg | null = null;
      for (const s of this.metroData.paths) {
        if (s.line !== seg.line || s.sentido !== seg.sentido) continue;
        if (usedIds.has(s.id) || s.path.length < 2) continue;
        const e = s.path[s.path.length - 1];
        const d = (e.x - searchFrom.x) ** 2 + (e.y - searchFrom.y) ** 2;
        if (d < best) { best = d; prev = s; }
      }
      if (!prev) break;
      prepended  = [...prev.path.slice(0, -1), ...prepended];
      searchFrom = prev.path[0];
      usedIds.add(prev.id);
    }

    // ── Append 1 next tramo (nose + arrow room) ─────────────────────────────
    let appended: { x: number; y: number }[] = [];
    const segTail = seg.path[seg.path.length - 1];
    { // block for scoping
      let best = CONNECT_SQ, next: typeof seg | null = null;
      for (const s of this.metroData.paths) {
        if (s.line !== seg.line || s.sentido !== seg.sentido) continue;
        if (usedIds.has(s.id) || s.path.length < 2) continue;
        const d = (s.path[0].x - segTail.x) ** 2 + (s.path[0].y - segTail.y) ** 2;
        if (d < best) { best = d; next = s; }
      }
      if (next) { appended = next.path.slice(1); usedIds.add(next.id); }
    }

    const path = [...prepended, ...seg.path, ...appended];

    // Compute segStart and segEnd arc positions within the composite path
    const lens    = this.computeArcLens(path);
    const segStart = lens[prepended.length];
    const segEnd   = lens[prepended.length + seg.path.length - 1];

    return { path, segStart, segEnd };
  }

  private roundedRect(
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

  // ── Clock & time ─────────────────────────────────────────────

  displayClock(): string {
    return new Date(this.time).toLocaleTimeString('en-GB', {
      timeZone: 'Etc/UTC', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  get dayProgress(): number {
    return (this.time % 86_400_000) / 86_400_000;
  }

  // ── Config steppers ──────────────────────────────────────────

  stepConfig(field: keyof typeof this.cfg.config, delta: number): void {
    const next = this.cfg.config[field] + delta;
    this.cfg.save({ ...this.cfg.config, [field]: next });
  }

  // ── Speed ────────────────────────────────────────────────────

  setSpeedIdx(i: number): void {
    this.speedIdx = i;
    this.wsService.send({ message: 'setSpeed', factor: this.localSpeed });
  }

  speedDown(): void { this.setSpeedIdx(Math.max(0, this.speedIdx - 1)); }
  speedUp():   void { this.setSpeedIdx(Math.min(TrainComponent.SPEED_PRESETS.length - 1, this.speedIdx + 1)); }

  // ── Simulation controls ───────────────────────────────────────

  playPause(): void {
    if (this.state.paused) {
      this.wsService.send({ message: 'resume' });
    } else {
      this.wsService.send({ message: 'pause' });
    }
  }

  resetSimulation(): void {
    const [h, m] = this.resetTime.split(':').map(Number);
    this.time = ((h || 6) * 3600 + (m || 0)) * 1000;
    this.state.reset();
    this.wsService.send({ message: 'reset' });
    this.cd.markForCheck();
  }

  // ── Load gauge ────────────────────────────────────────────────

  readonly gaugeCount = 16;
  gaugeCells(): string[] {
    const filled = Math.round(this.state.simLoad * this.gaugeCount);
    return Array.from({ length: this.gaugeCount }, (_, i) => {
      if (i >= filled) return '';
      if (i >= 14) return 'over';
      if (i >= 11) return 'warn';
      return 'on';
    });
  }

  // ── Formatting helpers ────────────────────────────────────────

  formatCount(n: number): string {
    if (n >= 100_000) return `${Math.round(n / 1000)}k`;
    if (n >= 10_000)  return `${(n / 1000).toFixed(1)}k`;
    if (n >= 1_000)   return `${(n / 1000).toFixed(2)}k`;
    return String(n);
  }

  sparklinePoints(values: number[]): string {
    const w = 100, h = 22;
    const max = Math.max(...values, 1);
    return values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  }

  // ── Stats helpers ─────────────────────────────────────────────

  linePeople(): [string, number][] {
    return Array.from(this.state.platformsPeople.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
  }

  allPeople(recipient: Map<string, number>): number {
    const values = Array.from(recipient.values());
    return values.length === 0 ? 0 : values.reduce((p, c) => p + c);
  }

  linePercent(count: number): number {
    const max = Math.max(...Array.from(this.state.platformsPeople.values()), 1);
    return Math.round((count / max) * 100);
  }

  lineColors(line: string): string {
    return LINE_COLORS[line] ?? '#6b7488';
  }

  // ── Telemetry strip ───────────────────────────────────────────

  get telemetryTrains(): number   { return this.state.trains.length; }
  get telemetrySegments(): number { return this.metroData.paths.length; }
  get telemetryStations(): number { return this.metroData.stations.length; }
  get telemetryUptime(): number   { return Math.floor(this.time / 60_000) % 999; }

  get zoomReadout(): string {
    return `×${(this.currentScale / this.fitScale).toFixed(2)}`;
  }

  get stationLabelItems() {
    return this.metroData.stations.map(s => {
      const lines = this.stationLineMap.get(s.name) ?? [];
      // Count occurrences per line ID to split aggregated totals across directions
      const lineOcc = new Map<string, number>();
      for (const l of lines) lineOcc.set(l, (lineOcc.get(l) ?? 0) + 1);
      const platforms = lines.map(l => ({
        line:  l,
        total: Math.round((this.state.platformsPeople.get(l) ?? 0) / (lineOcc.get(l) ?? 1)),
      }));
      const transit = lines.reduce((sum, l) => sum + (this.state.stationsPeople.get(l) ?? 0), 0);
      const total   = transit + platforms.reduce((sum, p) => sum + p.total, 0);
      return { name: s.name, x: s.position.x, y: s.position.y, lines, platforms, total, transit };
    });
  }

  fmtCount(n: number): string {
    if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
    if (n >= 1000)  return (n / 1000).toFixed(2) + 'k';
    return String(n);
  }

  get peakLabel(): string {
    const h = (this.time / 3_600_000) % 24;
    if (h >= 7.5 && h < 9.5)  return 'PEAK · AM';
    if (h >= 17  && h < 19.5) return 'PEAK · PM';
    if (h < 6 || h > 23)      return 'NIGHT';
    return 'OFF · PEAK';
  }
}
