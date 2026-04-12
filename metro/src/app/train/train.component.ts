import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { WebSocketService } from '../services/websocket.service';
import { MetroDataService } from '../services/metro-data.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { SimulationConfigService } from '../services/simulation-config.service';
import { REDRAW_PERIOD_MS, LINE_COLORS } from '../constants';

@Component({
  selector: 'app-train',
  standalone: true,
  imports: [],
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css']
})
export class TrainComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvasContainer', { static: false, read: ElementRef }) canvasContainer!: ElementRef;
  @ViewChild('canvas_stations', { static: false, read: ElementRef }) canvasStations!: ElementRef;
  @ViewChild('canvas_paths',    { static: false, read: ElementRef }) canvasPaths!: ElementRef;
  @ViewChild('canvas_trains',   { static: false, read: ElementRef }) canvasTrains!: ElementRef;

  private ctxStations!: CanvasRenderingContext2D;
  private ctxPaths!: CanvasRenderingContext2D;
  private ctxTrains!: CanvasRenderingContext2D;

  panelCollapsed = false;

  // Zoom state — exposed to template for the dev indicator
  currentScale = 1;
  protected fitScale  = 1;
  readonly isDev = !environment.production;

  // Pan state (screen pixels: where world origin maps to)
  private panX = 0;
  private panY = 0;

  private readonly dpr = window.devicePixelRatio || 1;

  private time = 6 * 3600 * 1000;
  private lastClockAdvance = 0;
  private rafId = 0;
  private needsStaticRedraw = false;
  private needsTrainRedraw  = false;
  private readonly destroy$ = new Subject<void>();
  private destroyed = false;

  // Label visibility pre-computed at fitScale — stable set across all zoom levels
  private labelVisible: boolean[] = [];

  // Fixed screen-pixel sizes (divide by currentScale when drawing in world coords)
  private static readonly PATH_WIDTH_PX      = 6;
  private static readonly DOT_RADIUS_PX      = 5;
  private static readonly DOT_STROKE_PX      = 1.2;
  private static readonly LABEL_SIZE_PX      = 11;   // low-zoom target (screen px)
  private static readonly LABEL_SIZE_ZOOM_PX = 13;   // high-zoom target (screen px)
  private static readonly LABEL_SHOW_ALL_MUL = 2.5;  // show all labels above this zoom multiplier

  constructor(
    private readonly wsService: WebSocketService,
    readonly metroData: MetroDataService,
    readonly state: SimulationStateService,
    readonly cfg: SimulationConfigService,
  ) {
    const lines = new Set(this.metroData.paths.map(p => p.line));
    this.state.initLines(Array.from(lines));
  }

  ngAfterViewInit(): void {
    this.resizeCanvases();

    this.ctxStations = this.canvasStations.nativeElement.getContext('2d')!;
    this.ctxPaths    = this.canvasPaths.nativeElement.getContext('2d')!;
    this.ctxTrains   = this.canvasTrains.nativeElement.getContext('2d')!;

    this.computeFit();
    this.computeLabelVisibility();
    this.setupEvents();

    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => this.state.process(msg));

    this.startRenderLoop();
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
    for (const ref of [this.canvasPaths, this.canvasStations, this.canvasTrains]) {
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

    const margin = 40; // screen px padding around the network
    const netW   = maxX - minX;
    const netH   = maxY - minY;
    this.fitScale    = Math.min((vW - margin * 2) / netW, (vH - margin * 2) / netH);
    this.currentScale = this.fitScale;
    this.panX = (vW - netW * this.fitScale) / 2 - minX * this.fitScale;
    this.panY = (vH - netH * this.fitScale) / 2 - minY * this.fitScale;
  }

  // ── Transform helpers ────────────────────────────────────────

  // Sets the ctx transform so world coords → physical canvas pixels
  private applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(
      this.currentScale * this.dpr, 0,
      0, this.currentScale * this.dpr,
      this.panX * this.dpr,
      this.panY * this.dpr,
    );
  }

  // Clears the entire physical canvas (ignores current transform)
  private clearCtx(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // ── Events ───────────────────────────────────────────────────

  private setupEvents(): void {
    const container = this.canvasContainer.nativeElement as HTMLElement;

    // Wheel: zoom toward cursor
    container.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const factor    = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale  = Math.max(
        this.fitScale * 0.5,
        Math.min(this.fitScale * 30, this.currentScale * factor),
      );
      const actual = newScale / this.currentScale;
      this.panX = e.clientX + (this.panX - e.clientX) * actual;
      this.panY = e.clientY + (this.panY - e.clientY) * actual;
      this.currentScale = newScale;
      this.needsStaticRedraw = true;
      this.needsTrainRedraw  = true;
    }, { passive: false });

    // Mouse drag: pan
    let dragging = false;
    let lastX = 0, lastY = 0;
    container.addEventListener('mousedown', (e: MouseEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      container.style.cursor = 'grabbing';
    });
    container.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return;
      this.panX += e.clientX - lastX;
      this.panY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this.needsStaticRedraw = true;
      this.needsTrainRedraw  = true;
    });
    const endDrag = () => { dragging = false; container.style.cursor = 'grab'; };
    container.addEventListener('mouseup',    endDrag);
    container.addEventListener('mouseleave', endDrag);

    // Window resize: resize canvases and redraw
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
      Math.min(this.fitScale * 30, this.currentScale * factor),
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

      if (this.needsStaticRedraw) {
        this.drawPaths();
        this.drawStations();
        this.needsStaticRedraw = false;
      }

      if (this.state.dirty || this.needsTrainRedraw) {
        this.drawTrains();
        this.state.dirty      = false;
        this.needsTrainRedraw = false;
      }

      if (timestamp - this.lastClockAdvance >= REDRAW_PERIOD_MS) {
        this.advanceClock();
        this.lastClockAdvance = timestamp;
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // ── Label size ───────────────────────────────────────────────

  // Interpolates font target from 11px (at zoom ×2.5) to 13px (at zoom ×5),
  // giving a smooth growth instead of a hard jump.
  private static readonly LABEL_ZOOM_HIGH = 5.0;

  private labelTargetPx(): number {
    const mul  = this.currentScale / this.fitScale;
    const low  = TrainComponent.LABEL_SHOW_ALL_MUL;  // 2.5
    const high = TrainComponent.LABEL_ZOOM_HIGH;      // 5.0
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

    ctx.lineWidth = TrainComponent.PATH_WIDTH_PX / this.currentScale;
    ctx.lineJoin  = 'round';
    ctx.lineCap   = 'round';

    for (const segment of this.metroData.paths) {
      if (segment.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(segment.path[0].x, segment.path[0].y);
      for (const p of segment.path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = this.lineColors(segment.line);
      ctx.stroke();
    }
  }

  // Pre-compute which labels to show at fitScale — stable across all zoom levels
  private computeLabelVisibility(): void {
    const scale   = this.fitScale;
    const fontSize = Math.round(TrainComponent.LABEL_SIZE_PX / scale);
    this.ctxStations.font = `${fontSize}px Inter, Verdana, sans-serif`;
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

  private drawStations(): void {
    const ctx   = this.ctxStations;
    const scale = this.currentScale;
    this.clearCtx(ctx);
    this.applyTransform(ctx);

    const r   = TrainComponent.DOT_RADIUS_PX / scale;
    const lw  = TrainComponent.DOT_STROKE_PX / scale;
    const showLabels = scale >= this.fitScale * 0.8;
    const showAll    = (scale / this.fitScale) >= TrainComponent.LABEL_SHOW_ALL_MUL;
    const fontSize   = Math.round(this.labelTargetPx() / scale);

    ctx.fillStyle   = 'white';
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth   = lw;
    if (showLabels) ctx.font = `${fontSize}px Inter, Verdana, sans-serif`;

    this.metroData.stations.forEach((station, i) => {
      const { x, y } = station.position;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.closePath();

      if (showLabels && (showAll || this.labelVisible[i])) {
        const padding = 2 / scale;
        const lx = x + r + padding;
        const ly = y + fontSize * 0.35;
        const bw = ctx.measureText(station.name).width + padding * 2;
        const bh = fontSize * 1.1;
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(lx - padding, ly - fontSize * 0.85, bw, bh);
        ctx.fillStyle = 'white';
        ctx.fillText(station.name, lx, ly);
      }
    });
  }

  private drawTrains(): void {
    const ctx   = this.ctxTrains;
    const scale = this.currentScale;
    this.clearCtx(ctx);
    this.applyTransform(ctx);

    ctx.fillStyle = 'red';
    const w = 12 / scale;
    const h =  5 / scale;
    for (const train of this.state.trains) {
      ctx.fillRect(train.x, train.y, w, h);
    }
  }

  // ── Clock ────────────────────────────────────────────────────

  private advanceClock(): void {
    this.time += REDRAW_PERIOD_MS / this.state.timeMultiplier;
  }

  displayClock(): string {
    return new Date(this.time).toLocaleTimeString('en-GB', {
      timeZone: 'Etc/UTC', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  // ── Stats helpers ────────────────────────────────────────────

  linePeople(): [string, number][] {
    return Array.from(this.state.platformsPeople.entries())
      .sort((a, b) => b[1] - a[1]);
  }

  allPeople(recipient: Map<string, number>): number {
    const values = Array.from(recipient.values());
    return values.length === 0 ? 0 : values.reduce((p, c) => p + c);
  }

  linePercent(count: number): number {
    const max = Math.max(...Array.from(this.state.platformsPeople.values()), 1);
    return Math.round((count / max) * 100);
  }

  computeCheckPeople(): number {
    return this.state.metroPeople
      - this.state.trainsPeople
      - this.allPeople(this.state.platformsPeople)
      - this.allPeople(this.state.stationsPeople);
  }

  lineColors(line: string): string {
    return LINE_COLORS[line] ?? 'red';
  }
}
