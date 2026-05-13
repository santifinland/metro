import { Component, ElementRef, AfterViewInit, OnDestroy, OnInit, NgZone, ChangeDetectionStrategy, signal, computed, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { WebSocketService } from '../services/websocket.service';
import { MetroDataService } from '../services/metro-data.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { SimulationConfigService } from '../services/simulation-config.service';
import { CanvasViewportService } from '../services/canvas-viewport.service';
import { PathGeometryService } from '../services/path-geometry.service';
import { MetroRendererService } from '../services/metro-renderer.service';
import { SimulationClockService } from '../services/simulation-clock.service';
import { TileService } from '../services/tile.service';
import { TRAIN_WAGONS, DEFAULT_WAGONS, WAGON_W, WAGON_H, WAGON_GAP, TRAIN_HIT_PX, STATION_HIT_PX, CD_TICK_MS } from '../constants';
import { lineColor, fmtCount, groupByDest } from '../utils/format';
import { NodeId } from '../utils/node-id';
import { computeArcLens } from '../utils/path-geometry';

import { PersonTrackerComponent } from './person-tracker/person-tracker.component';
import { TrainPanelComponent } from './train-panel/train-panel.component';
import { TelemetryPanelComponent } from './telemetry-panel/telemetry-panel.component';
import { ControlPanelComponent } from './control-panel/control-panel.component';
import { MapInteractionDirective } from './map-interaction.directive';
import { StationCardComponent } from './station-card/station-card.component';
import { BottomTelemetryComponent } from './bottom-telemetry/bottom-telemetry.component';
import { StationLabelItem } from './station-label-item';

@Component({
  selector: 'app-train',
  standalone: true,
  imports: [NgClass, PersonTrackerComponent, TrainPanelComponent, TelemetryPanelComponent, ControlPanelComponent, MapInteractionDirective, StationCardComponent, BottomTelemetryComponent],
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CanvasViewportService, MetroRendererService],
})
export class TrainComponent implements AfterViewInit, OnDestroy, OnInit {

  readonly canvasContainer = viewChild.required<ElementRef<HTMLElement>>('canvasContainer');
  readonly canvasTiles     = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas_tiles');
  readonly canvasStations  = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas_stations');
  readonly canvasPaths     = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas_paths');
  readonly canvasTrains    = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas_trains');

  private _mouseContainerX = -1;
  private _mouseContainerY = -1;

  readonly showAllPanels   = signal(false);
  readonly stationsHidden  = signal(false);
  readonly selectedStationIdx = signal(-1);
  readonly hoveredStationIdx  = signal(-1);

  // Computed overlay container classes (#103)
  readonly overlayClasses = computed(() => {
    const fitMul = this.viewport.scale() / this.viewport.fitScale();
    const show   = this.showAllPanels();
    const hide   = this.stationsHidden();
    return {
      'show-interchange': !hide && (fitMul > 1.05 || show),
      'show-all':         !hide && (fitMul > 1.7  || show),
      'show-panel':       !hide && (fitMul > 15   || show),
      'zoom-deep':        fitMul > 7,
    };
  });

  private ctxTiles!: CanvasRenderingContext2D;
  private ctxStations!: CanvasRenderingContext2D;
  private ctxPaths!: CanvasRenderingContext2D;
  private ctxTrains!: CanvasRenderingContext2D;

  showSatellite = false;
  readonly isDev = !environment.production;

  private readonly dpr = window.devicePixelRatio || 1;

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

  // Static part precomputed once in buildStationLineMap (#102)
  private staticStations: Array<{
    name: string; x: number; y: number; lines: string[];
    platforms: Array<{ id: string; line: string; sentido: string; destination: string }>;
  }> = [];

  selectedTrainId: string | null = null;
  hoveredTrainId: string | null = null;
  trainPanelX = 0;
  trainPanelY = 0;
  readonly inspectedPlatformId = signal<string | null>(null);

  readonly peopleHistory = signal<number[]>(Array(40).fill(0));

  private static readonly PATH_WIDTH_PX      = 6;
  private static readonly DOT_RADIUS_PX      = 5;
  private static readonly DOT_STROKE_PX      = 1.2;
  private static readonly LABEL_SIZE_PX      = 11;
  private static readonly LABEL_SIZE_ZOOM_PX = 13;
  private static readonly LABEL_SHOW_ALL_MUL = 2.5;

  constructor(
    private readonly wsService: WebSocketService,
    private readonly ngZone: NgZone,
    readonly metroData: MetroDataService,
    readonly state: SimulationStateService,
    readonly cfg: SimulationConfigService,
    readonly viewport: CanvasViewportService,
    readonly clock: SimulationClockService,
    private readonly pathGeo: PathGeometryService,
    private readonly renderer: MetroRendererService,
    private readonly tileService: TileService,
  ) {
    const lines = new Set(this.metroData.segments.map(p => p.line));
    this.state.initLines(Array.from(lines));
  }

  ngOnInit(): void {
    this.buildStationLineMap();
  }

  ngAfterViewInit(): void {
    this.resizeCanvases();

    this.ctxTiles    = this.canvasTiles().nativeElement.getContext('2d')!;
    this.ctxStations = this.canvasStations().nativeElement.getContext('2d')!;
    this.ctxPaths    = this.canvasPaths().nativeElement.getContext('2d')!;
    this.ctxTrains   = this.canvasTrains().nativeElement.getContext('2d')!;

    this.viewport.init(this.dpr);
    this.computeFit();

    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;

    this.wsService.setSpeed(this.localSpeed);

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => {
        if (msg.message === 'simTime') {
          this.clock.syncFromBackend(msg.ms);
        }
        if (msg.message === 'reset') {
          this.clock.resetTo(this.resetTime);
          this.state.reset();
        }
        this.state.process(msg);
        if ((msg.message === 'newTrain' || msg.message === 'moveTrain') && msg.anden != null) {
          const train = this.state.getTrain(msg.train);
          const view  = this.state.getTrainView(msg.train);
          if (train && view) {
            const seg = this.metroData.segments.find(s => s.id === String(msg.anden));
            if (seg && seg.path.length >= 2) {
              const { path, segStart, segEnd } = this.pathGeo.buildCompositePath(seg);
              view.pathPoints   = path;
              view.pathArcLens  = computeArcLens(path);
              view.pathSegStart = segStart;
              view.pathSegEnd   = segEnd;
              train.line     = seg.line;
              train.capacity = (TRAIN_WAGONS[seg.line] ?? DEFAULT_WAGONS) * this.cfg.config.wagonCapacity;
              const last = path[path.length - 1];
              const prev = path[path.length - 2];
              view.heading = Math.atan2(last.y - prev.y, last.x - prev.x);
            }
          }
        }
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
    const el = this.canvasContainer().nativeElement as HTMLElement;
    const W  = el.clientWidth;
    const H  = el.clientHeight;
    for (const ref of [this.canvasTiles, this.canvasPaths, this.canvasStations, this.canvasTrains]) {
      const c = ref().nativeElement as HTMLCanvasElement;
      c.width  = W * this.dpr;
      c.height = H * this.dpr;
      c.style.width  = `${W}px`;
      c.style.height = `${H}px`;
    }
  }

  // ── Fit computation ──────────────────────────────────────────

  private computeFit(): void {
    const container = this.canvasContainer().nativeElement as HTMLElement;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.metroData.segments) {
      for (const p of s.path) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    this.viewport.computeFit(
      { minX, minY, maxX, maxY },
      container.clientWidth,
      container.clientHeight,
    );
  }

  // ── Events (handled via MapInteractionDirective outputs) ──────

  onMapZoom(e: { factor: number; anchorX: number; anchorY: number }): void {
    this.viewport.zoomAt(e.factor, e.anchorX, e.anchorY);
    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;
  }

  onMapPan(e: { dx: number; dy: number }): void {
    this.viewport.pan(e.dx, e.dy);
    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;
  }

  onMapMove(e: { x: number; y: number }): void {
    this._mouseContainerX = e.x;
    this._mouseContainerY = e.y;
    this.hoveredStationIdx.set(this.findNearestStation(e.x, e.y, 14));
    const container = this.canvasContainer().nativeElement as HTMLElement;
    const nearTrain = this.findNearestTrain(e.x, e.y, 40);
    if (nearTrain) { container.style.cursor = 'pointer'; return; }
    container.style.cursor = this.hoveredStationIdx() >= 0 ? 'pointer' : 'grab';
  }

  onMapClick(e: { x: number; y: number }): void {
    this.handleMapClick(e.x, e.y);
  }

  onMapLeave(): void {
    this._mouseContainerX = -1;
    this._mouseContainerY = -1;
    (this.canvasContainer().nativeElement as HTMLElement).style.cursor = 'grab';
  }

  onMapResize(): void {
    this.resizeCanvases();
    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;
  }

  // ── Zoom controls ────────────────────────────────────────────

  zoomIn(): void  { this.viewport.zoomAt(1.3,       this.canvasContainer().nativeElement.clientWidth / 2, this.canvasContainer().nativeElement.clientHeight / 2); this.needsStaticRedraw = true; this.needsTrainRedraw = true; }
  zoomOut(): void { this.viewport.zoomAt(1 / 1.3,   this.canvasContainer().nativeElement.clientWidth / 2, this.canvasContainer().nativeElement.clientHeight / 2); this.needsStaticRedraw = true; this.needsTrainRedraw = true; }

  zoomReset(): void {
    this.computeFit();
    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;
  }


  // ── Render loop ──────────────────────────────────────────────

  private startRenderLoop(): void {
    const loop = (timestamp: number) => {
      if (this.destroyed) return;

      const dt = this.lastRafTimestamp > 0 ? timestamp - this.lastRafTimestamp : 0;
      this.lastRafTimestamp = timestamp;
      if (!this.state.paused()) {
        this.clock.advance(dt, this.localSpeed);
      }

      if (this.needsStaticRedraw) {
        this.drawTiles();
        this.renderer.drawPaths(this.ctxPaths);
        this.renderer.drawStations(this.ctxStations);
        this.needsStaticRedraw = false;
      }

      this.drawTrains(timestamp);
      this.updateTrainPanel();
      this.needsTrainRedraw = false;

      if (timestamp - this.lastCdTick >= CD_TICK_MS) {
        this.lastCdTick = timestamp;
        const next = this.state.metroPeople();
        this.peopleHistory.update(h => [...h.slice(1), next]);
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // ── Label size ───────────────────────────────────────────────

  private static readonly LABEL_ZOOM_HIGH = 5.0;

  private labelTargetPx(): number {
    const mul  = this.viewport.scale() / this.viewport.fitScale();
    const low  = TrainComponent.LABEL_SHOW_ALL_MUL;
    const high = TrainComponent.LABEL_ZOOM_HIGH;
    if (mul <= low)  return TrainComponent.LABEL_SIZE_PX;
    if (mul >= high) return TrainComponent.LABEL_SIZE_ZOOM_PX;
    const t = (mul - low) / (high - low);
    return TrainComponent.LABEL_SIZE_PX + t * (TrainComponent.LABEL_SIZE_ZOOM_PX - TrainComponent.LABEL_SIZE_PX);
  }

  // ── Drawing ──────────────────────────────────────────────────

  toggleSatellite(): void {
    this.showSatellite = !this.showSatellite;
    this.needsStaticRedraw = true;
  }

  private drawTiles(): void {
    this.viewport.clearCtx(this.ctxTiles);
    if (!this.showSatellite) return;
    this.viewport.applyTransform(this.ctxTiles);
    this.tileService.drawTiles(
      this.ctxTiles,
      this.viewport.scale(),
      this.viewport.panX(),
      this.viewport.panY(),
      this.dpr,
      () => { this.needsStaticRedraw = true; },
    );
  }

  private drawPaths(): void { this.renderer.drawPaths(this.ctxPaths); }

  private findNearestStation(cx: number, cy: number, hitPx = STATION_HIT_PX): number {
    const scale = this.viewport.scale();
    const panX  = this.viewport.panX();
    const panY  = this.viewport.panY();
    let bestIdx = -1, bestDist = hitPx * hitPx;
    this.metroData.stations.forEach((s, i) => {
      const sx = s.position.x * scale + panX;
      const sy = s.position.y * scale + panY;
      const d2 = (cx - sx) ** 2 + (cy - sy) ** 2;
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; }
    });
    return bestIdx;
  }

  private findNearestTrain(cx: number, cy: number, hitPx = TRAIN_HIT_PX): string | null {
    const scale = this.viewport.scale();
    const panX  = this.viewport.panX();
    const panY  = this.viewport.panY();
    let best: string | null = null;
    let bestDist = hitPx * hitPx;
    for (const v of this.state.getTrainViews().values()) {
      const tx = v.x * scale + panX;
      const ty = v.y * scale + panY;
      const d2 = (cx - tx) ** 2 + (cy - ty) ** 2;
      if (d2 < bestDist) { bestDist = d2; best = v.id; }
    }
    return best;
  }

  get selectedTrain() { return this.selectedTrainId ? this.state.getTrain(this.selectedTrainId) : undefined; }

  private handleMapClick(x: number, y: number): void {
    const nearTrain = this.findNearestTrain(x, y, 40);
    if (nearTrain) {
      this.selectedTrainId = nearTrain === this.selectedTrainId ? null : nearTrain;
      this.selectedStationIdx.set(-1);
      return;
    }
    const bestIdx = this.findNearestStation(x, y);
    this.selectedStationIdx.update(cur => bestIdx === cur ? -1 : bestIdx);
    this.selectedTrainId = null;
  }

  toggleShowAllPanels(): void {
    if (!this.showAllPanels()) {
      this.showAllPanels.set(true);
      this.stationsHidden.set(false);
    } else {
      this.showAllPanels.set(false);
      this.stationsHidden.set(true);
    }
  }

  private updateTrainPanel(): void {
    this.hoveredTrainId = this.findNearestTrain(this._mouseContainerX, this._mouseContainerY);
    if (!this.selectedTrainId) return;
    const v = this.state.getTrainView(this.selectedTrainId);
    if (!v) { this.selectedTrainId = null; return; }
    this.trainPanelX = v.x * this.viewport.scale() + this.viewport.panX();
    this.trainPanelY = v.y * this.viewport.scale() + this.viewport.panY();
  }

  selectPerson(personId: string): void {
    this.state.trackPerson(personId);
    this.wsService.trackPerson(personId);
    this.wsService.resume();
  }

  togglePlatformInspect(anderId: string): void {
    if (this.inspectedPlatformId() === anderId) {
      this.inspectedPlatformId.set(null);
      this.wsService.resume();
      return;
    }
    this.inspectedPlatformId.set(anderId);
    this.wsService.pause();
    this.wsService.requestPlatformPersons(anderId);
  }

  onStationLabelClick(idx: number): void {
    this.selectedStationIdx.update(cur => cur === idx ? -1 : idx);
  }

  // Build a polyline following actual rail geometry for the person's planned path.

  private buildStationLineMap(): void {
    const lineMap   = new Map<string, string[]>();
    const platformMap = new Map<string, { id: string; sentido: string }[]>();
    const seen = new Map<string, Set<string>>();
    for (const p of this.metroData.segments) {
      const dirKey = p.line + '/' + p.sentido;
      if (!seen.has(p.name)) seen.set(p.name, new Set());
      if (!seen.get(p.name)!.has(dirKey)) {
        seen.get(p.name)!.add(dirKey);
        const lines = lineMap.get(p.name) ?? [];
        lines.push(p.line);
        lineMap.set(p.name, lines);
        const pids = platformMap.get(p.name) ?? [];
        pids.push({ id: p.id, sentido: p.sentido });
        platformMap.set(p.name, pids);
      }
    }
    // Precompute static station data (#102)
    this.staticStations = this.metroData.stations.map(s => {
      const lines    = lineMap.get(s.name) ?? [];
      const pEntries = platformMap.get(s.name) ?? [];
      const platforms = pEntries.map((pe, idx) => {
        const line = lines[idx] ?? '';
        const dest = this.metroData.lineDestinations.get(`${line}/${pe.sentido}`) ?? '';
        return { id: pe.id, line, sentido: pe.sentido, destination: dest };
      });
      // disambiguate duplicate destinations
      const destCount = new Map<string, number>();
      platforms.forEach(p => destCount.set(p.destination, (destCount.get(p.destination) ?? 0) + 1));
      platforms.forEach(p => {
        if (p.destination && (destCount.get(p.destination) ?? 0) > 1) p.destination += ` ·${p.sentido}`;
      });
      return { name: s.name, x: s.position.x, y: s.position.y, lines, platforms };
    });
  }

  private drawStations(): void { this.renderer.drawStations(this.ctxStations); }

  private drawTrains(now: number): void {
    this.renderer.drawTrains(
      this.ctxTrains,
      this.state.trains(),
      this.state.getTrainViews(),
      now,
      this.hoveredTrainId,
      this.selectedTrainId,
      this.state.tracked(),
    );
  }

  // ── Clock & time ─────────────────────────────────────────────

  displayClock = this.clock.displayClock;
  get dayProgress(): number { return this.clock.dayProgress(); }

  // ── Speed ────────────────────────────────────────────────────

  onSpeedChange(idx: number): void {
    const oldSpeed = this.localSpeed;
    this.speedIdx = idx;
    const newSpeed = this.localSpeed;
    const now = performance.now();
    const ratio = oldSpeed / newSpeed;
    for (const view of this.state.getTrainViews().values()) {
      if (view.travelMs > 0) {
        const elapsed = now - view.departedAt;
        if (elapsed < view.travelMs) {
          view.travelMs = elapsed + (view.travelMs - elapsed) * ratio;
        }
      }
    }
    this.wsService.setSpeed(newSpeed);
  }

  // ── Simulation controls ───────────────────────────────────────

  resetSimulation(): void {
    this.clock.resetTo(this.resetTime);
    this.state.reset();
    this.wsService.reset();
  }

  // ── Formatting helpers ────────────────────────────────────────

  lineColors(line: string): string { return lineColor(line); }
  fmtCount(n: number): string { return fmtCount(n); }

  private resolveDestLabel(code: string): string {
    return this.metroData.stationsByCode.get(code)?.name ?? code;
  }

  groupByDest(persons: Array<{ id: string; destination: string }>): Array<{ destination: string; ids: string[] }> {
    return groupByDest(persons, code => this.resolveDestLabel(code));
  }

  // ── Stats helpers ─────────────────────────────────────────────

  get zoomReadout(): string { return this.viewport.zoomReadout(); }

  get telemetryTrains(): number   { return this.state.trains().length; }

  get telemetrySegments(): number { return this.metroData.segments.length; }
  get telemetryStations(): number { return this.metroData.stations.length; }
  get telemetryUptime(): number   { return this.clock.uptime(); }

  // Reactive computed — only reruns when stationIdPeople or andenPeople signals change (#102)
  readonly stationLabelItems = computed((): StationLabelItem[] => {
    const stationIdPeople = this.state.stationIdPeople();
    const andenPeople     = this.state.andenPeople();
    const transitByName   = new Map<string, number>();
    stationIdPeople.forEach((count, stationId) => {
      const s = this.metroData.stationsByCode.get(NodeId.parse(stationId)?.code ?? stationId);
      if (s) transitByName.set(s.name, (transitByName.get(s.name) ?? 0) + count);
    });
    return this.staticStations.map(s => {
      const platforms = s.platforms.map(p => ({
        ...p,
        total: andenPeople.get(parseInt(p.id, 10)) ?? 0,
      }));
      const transit = transitByName.get(s.name) ?? 0;
      const total   = transit + platforms.reduce((sum, p) => sum + p.total, 0);
      return { ...s, platforms, total, transit };
    });
  });

  get peakLabel(): string { return this.clock.peakLabel(); }
}
