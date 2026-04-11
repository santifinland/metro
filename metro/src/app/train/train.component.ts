import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
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

  ngAfterViewInit(): void {
    this.ctxStations = this.canvasStations.nativeElement.getContext('2d');
    this.ctx = this.canvasPaths.nativeElement.getContext('2d');
    this.ctxTrains = this.canvasTrains.nativeElement.getContext('2d');
    this.ctxTrains.fillStyle = 'red';

    this.drawPaths(this.ctx, this.metroData.paths);
    this.drawStations(this.ctxStations, this.metroData.stations);
    this.panAndZoom();

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

    // Mirror every pan/zoom from driver to followers
    const sync = (e: any) => {
      const { x, y, scale } = e.detail;
      followers.forEach(f => {
        f.zoom(scale, { animate: false });
        f.pan(x, y, { animate: false });
      });
    };
    this.canvasTrains.nativeElement.addEventListener('panzoompan',  sync);
    this.canvasTrains.nativeElement.addEventListener('panzoomzoom', sync);

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

  private drawStations(ctx: CanvasRenderingContext2D, stations: Station[]): void {
    ctx.font = '8px Verdana';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    for (const station of stations) {
      ctx.fillText(station.name, station.position.x + 7, station.position.y + 3);
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.arc(station.position.x, station.position.y, 5, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.stroke();
      ctx.closePath();
    }
  }

  private drawPaths(ctx: CanvasRenderingContext2D, stations: Station[]): void {
    for (const station of stations) {
      ctx.lineWidth = 6;
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
