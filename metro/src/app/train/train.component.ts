import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { WebSocketService } from '../services/websocket.service';
import { MetroDataService } from '../services/metro-data.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { SimulationConfigService } from '../services/simulation-config.service';
import { LINE_COLORS } from '../constants';

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
        this.cd.detectChanges();
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
        Math.min(this.fitScale * 30, this.currentScale * factor),
      );
      const actual = newScale / this.currentScale;
      this.panX = e.clientX + (this.panX - e.clientX) * actual;
      this.panY = e.clientY + (this.panY - e.clientY) * actual;
      this.currentScale = newScale;
      this.needsStaticRedraw = true;
      this.needsTrainRedraw  = true;
    }, { passive: false });

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

      const dt = this.lastRafTimestamp > 0 ? timestamp - this.lastRafTimestamp : 0;
      this.lastRafTimestamp = timestamp;
      if (!this.state.paused) {
        this.time += dt * this.localSpeed;
      }

      if (this.needsStaticRedraw) {
        this.drawPaths();
        this.drawStations();
        this.needsStaticRedraw = false;
      }

      this.drawTrains(timestamp);
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

    ctx.lineWidth   = lw;
    if (showLabels) ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

    this.metroData.stations.forEach((station, i) => {
      const { x, y } = station.position;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle   = '#0c0e11';
      ctx.fill();
      ctx.strokeStyle = '#e6ebf2';
      ctx.stroke();
      ctx.closePath();

      if (showLabels && (showAll || this.labelVisible[i])) {
        const padding = 2 / scale;
        const lx = x + r + padding;
        const ly = y + fontSize * 0.35;
        const bw = ctx.measureText(station.name).width + padding * 2;
        const bh = fontSize * 1.1;
        ctx.fillStyle = 'rgba(8,9,11,0.9)';
        ctx.fillRect(lx - padding, ly - fontSize * 0.85, bw, bh);
        ctx.fillStyle = '#e6ebf2';
        ctx.fillText(station.name, lx, ly);
      }
    });
  }

  private drawTrains(now: number): void {
    const ctx   = this.ctxTrains;
    const scale = this.currentScale;
    this.clearCtx(ctx);
    this.applyTransform(ctx);

    const w  = 18 / scale;
    const h  =  7 / scale;
    const r  =  h / 2;
    const lw =  1 / scale;

    ctx.lineWidth = lw;

    for (const train of this.state.trains) {
      if (train.travelMs > 0) {
        const t    = Math.min(1, (now - train.departedAt) / train.travelMs);
        const ease = t * t * (3 - 2 * t);
        train.x = train.fromX + (train.targetX - train.fromX) * ease;
        train.y = train.fromY + (train.targetY - train.fromY) * ease;
      }

      const x   = train.x - w / 2;
      const y   = train.y - h / 2;
      const occ = train.capacity > 0 ? Math.min(1, train.people / train.capacity) : 0;

      ctx.save();

      this.pillRect(ctx, x, y, w, h, r);
      ctx.fillStyle = '#11141a';
      ctx.fill();

      ctx.clip();
      ctx.fillStyle = occ < 0.5 ? '#4ade80' : occ < 0.8 ? '#fbbf24' : '#f87171';
      ctx.fillRect(x, y, w * occ, h);

      ctx.restore();

      this.pillRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.stroke();
    }
  }

  private pillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
    this.cd.detectChanges();
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

  get peakLabel(): string {
    const h = (this.time / 3_600_000) % 24;
    if (h >= 7.5 && h < 9.5)  return 'PEAK · AM';
    if (h >= 17  && h < 19.5) return 'PEAK · PM';
    if (h < 6 || h > 23)      return 'NIGHT';
    return 'OFF · PEAK';
  }
}
