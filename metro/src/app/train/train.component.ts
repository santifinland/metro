import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import Panzoom from '@panzoom/panzoom';

import { WebSocketService } from '../services/websocket.service';
import { MetroDataService } from '../services/metro-data.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { SimulationConfigService } from '../services/simulation-config.service';
import { Station } from '../station';
import { Train } from '../train';
import { CANVAS_WIDTH, CANVAS_HEIGHT, REDRAW_PERIOD_MS, LINE_COLORS } from '../constants';

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
  @ViewChild('canvas_paths', { static: false, read: ElementRef }) canvasPaths!: ElementRef;
  @ViewChild('canvas_trains', { static: false, read: ElementRef }) canvasTrains!: ElementRef;

  private ctxStations!: CanvasRenderingContext2D;
  private ctx!: CanvasRenderingContext2D;
  private ctxTrains!: CanvasRenderingContext2D;

  readonly width = CANVAS_WIDTH;
  readonly height = CANVAS_HEIGHT;

  panelCollapsed = false;

  private panzoomInstances: ReturnType<typeof Panzoom>[] = [];
  currentScale = 1;
  protected fitScale = 1;
  // Labels visible at fit zoom (pre-computed once, stable across zoom changes)
  private labelVisible: boolean[] = [];
  // Above this zoom multiplier, show all labels (viewport is small enough)
  private static readonly LABEL_SHOW_ALL_ZOOM = 2.5;
  readonly isDev = !environment.production;
  private time = 6 * 3600 * 1000;
  private lastClockAdvance = 0;
  private rafId = 0;
  private readonly destroy$ = new Subject<void>();
  private destroyed = false;

  constructor(
    private readonly wsService: WebSocketService,
    readonly metroData: MetroDataService,
    readonly state: SimulationStateService,
    readonly cfg: SimulationConfigService,
  ) {
    const lines = new Set(this.metroData.paths.map(p => p.line));
    this.state.initLines(Array.from(lines));
  }

  private setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CANVAS_WIDTH  * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width  = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    return ctx;
  }

  ngAfterViewInit(): void {
    this.ctxStations = this.setupCanvas(this.canvasStations.nativeElement);
    this.ctx         = this.setupCanvas(this.canvasPaths.nativeElement);
    this.ctxTrains   = this.setupCanvas(this.canvasTrains.nativeElement);
    this.ctxTrains.fillStyle = 'red';

    this.panAndZoom();
    this.computeLabelVisibility();
    this.drawPaths(this.ctx, this.metroData.paths, this.currentScale);
    this.drawStations(this.ctxStations, this.metroData.stations, this.currentScale);

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

  private startRenderLoop(): void {
    const loop = (timestamp: number) => {
      if (this.destroyed) return;

      if (this.state.dirty) {
        this.drawTrains(this.state.trains);
        this.state.dirty = false;
      }

      if (timestamp - this.lastClockAdvance >= REDRAW_PERIOD_MS) {
        this.advanceClock();
        this.lastClockAdvance = timestamp;
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private panAndZoom(): void {
    const container: HTMLElement = this.canvasContainer.nativeElement;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const fitScale = Math.min(W / CANVAS_WIDTH, H / CANVAS_HEIGHT);

    // Transform is: scale(s) translate(x, y) with origin 50% 50%.
    // To center canvas center (OX,OY) at viewport (W/2,H/2): x = (W/2 - OX) / s
    const startX = (W / 2 - CANVAS_WIDTH / 2) / fitScale;
    const startY = (H / 2 - CANVAS_HEIGHT / 2) / fitScale;

    // "Driver" instance — owns all interaction (canvas:true binds to parent)
    const driver = Panzoom(this.canvasTrains.nativeElement, {
      maxScale: 10, minScale: 0.05, canvas: true, step: 0.3,
      startScale: fitScale, startX, startY,
    });
    // Follower instances — canvas:false so they do NOT attach their own listeners
    const followers = [
      Panzoom(this.canvasPaths.nativeElement,    { canvas: false, startScale: fitScale, startX, startY }),
      Panzoom(this.canvasStations.nativeElement,  { canvas: false, startScale: fitScale, startX, startY }),
    ];
    this.panzoomInstances = [driver, ...followers];

    this.currentScale = fitScale;
    this.fitScale = fitScale;

    // Mirror every pan/zoom from driver to followers; redraw static layers on zoom
    const sync = (e: any) => {
      const { x, y, scale } = e.detail;
      followers.forEach(f => {
        f.zoom(scale, { animate: false });
        f.pan(x, y, { animate: false });
      });
    };
    const syncAndRedraw = (e: any) => {
      const { x, y, scale } = e.detail;
      this.currentScale = scale;
      followers.forEach(f => {
        f.zoom(scale, { animate: false });
        f.pan(x, y, { animate: false });
      });
      this.drawPaths(this.ctx, this.metroData.paths, scale);
      this.drawStations(this.ctxStations, this.metroData.stations, scale);
    };
    this.canvasTrains.nativeElement.addEventListener('panzoompan',  sync);
    this.canvasTrains.nativeElement.addEventListener('panzoomzoom', syncAndRedraw);

    // Wheel zoom (driver handles it; sync fires automatically via events above)
    container.addEventListener('wheel', (event: any) => {
      driver.zoomWithWheel(event);
    }, { passive: false });
  }

  zoomIn(): void {
    this.panzoomInstances.forEach(p => p.zoomIn());
  }

  zoomOut(): void {
    this.panzoomInstances.forEach(p => p.zoomOut());
  }

  zoomReset(): void {
    const container: HTMLElement = this.canvasContainer.nativeElement;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const fitScale = Math.min(W / CANVAS_WIDTH, H / CANVAS_HEIGHT);
    const x = (W / 2 - CANVAS_WIDTH / 2) / fitScale;
    const y = (H / 2 - CANVAS_HEIGHT / 2) / fitScale;
    this.panzoomInstances.forEach(p => p.zoom(fitScale, { animate: true }));
    this.panzoomInstances.forEach(p => p.pan(x, y, { animate: true }));
  }

  // Target visual sizes in CSS pixels (independent of zoom)
  private static readonly DOT_RADIUS_PX   = 5;   // station dot radius on screen
  private static readonly DOT_STROKE_PX   = 1.2;
  private static readonly LABEL_SIZE_PX      = 11;  // font size on screen (low zoom)
  private static readonly LABEL_SIZE_ZOOM_PX = 13;  // font size on screen (high zoom / show-all)
  private static readonly LABEL_MIN_SCALE    = 0.35; // hide labels below this zoom

  // Responsive line width: ~6px on a 1200px-wide container, scales with viewport
  private get pathWidthPx(): number {
    const w = (this.canvasContainer.nativeElement as HTMLElement).clientWidth;
    return Math.max(4, Math.min(8, w / 200));
  }

  // Pre-compute which labels to show at fitScale (stable set across all zoom levels).
  private computeLabelVisibility(): void {
    const scale = this.fitScale;
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
        bx < p.x + p.w && bx + bw > p.x && by < p.y + p.h && by + bh > p.y
      );
      if (!overlaps) { placed.push({ x: bx, y: by, w: bw, h: bh }); }
      return !overlaps;
    });
  }

  private drawStations(ctx: CanvasRenderingContext2D, stations: Station[], scale: number): void {
    ctx.clearRect(0, 0, this.width, this.height);
    const r   = TrainComponent.DOT_RADIUS_PX / scale;
    const lw  = TrainComponent.DOT_STROKE_PX / scale;
    const showLabels = scale >= TrainComponent.LABEL_MIN_SCALE;
    // At high zoom the viewport shows only a small area, so show all labels
    const showAll = (scale / this.fitScale) >= TrainComponent.LABEL_SHOW_ALL_ZOOM;
    const targetPx = showAll ? TrainComponent.LABEL_SIZE_ZOOM_PX : TrainComponent.LABEL_SIZE_PX;
    const fontSize = Math.round(targetPx / scale);

    ctx.fillStyle   = 'white';
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth   = lw;
    if (showLabels) {
      ctx.font = `${fontSize}px Inter, Verdana, sans-serif`;
    }

    stations.forEach((station, i) => {
      const { x, y } = station.position;
      // Dot
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.closePath();
      // Label: use pre-computed visibility or show all at high zoom
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

  private drawPaths(ctx: CanvasRenderingContext2D, stations: Station[], scale: number): void {
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineWidth  = this.pathWidthPx / scale;
    ctx.lineJoin   = 'round';
    ctx.lineCap    = 'round';
    for (const station of stations) {
      if (station.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(station.path[0].x, station.path[0].y);
      for (const p of station.path.slice(1)) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = this.lineColors(station.line);
      ctx.stroke();
      ctx.closePath();
    }
  }

  private drawTrains(trains: Train[]): void {
    this.ctxTrains.clearRect(0, 0, this.width, this.height);
    for (const train of trains) {
      this.ctxTrains.fillRect(train.x, train.y, 15, 5);
    }
  }

  private advanceClock(): void {
    this.time += REDRAW_PERIOD_MS / this.state.timeMultiplier;
  }

  displayClock(): string {
    return new Date(this.time).toLocaleTimeString('en-GB', {
      timeZone: 'Etc/UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

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
