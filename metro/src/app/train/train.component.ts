import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnInit, NgZone, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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
import { TRAIN_WAGONS, DEFAULT_WAGONS, WAGON_W, WAGON_H, WAGON_GAP } from '../constants';
import { lineColor, fmtCount, groupByDest } from '../utils/format';
import { NodeId } from '../utils/node-id';
import { computeArcLens } from '../utils/path-geometry';

import { PersonTrackerComponent } from './person-tracker/person-tracker.component';
import { TrainPanelComponent } from './train-panel/train-panel.component';
import { TelemetryPanelComponent } from './telemetry-panel/telemetry-panel.component';
import { ControlPanelComponent } from './control-panel/control-panel.component';
import { MapInteractionDirective } from './map-interaction.directive';

@Component({
  selector: 'app-train',
  standalone: true,
  imports: [PersonTrackerComponent, TrainPanelComponent, TelemetryPanelComponent, ControlPanelComponent, MapInteractionDirective],
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CanvasViewportService, MetroRendererService],
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
  private stationsHidden = false;

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

  private stationLineMap = new Map<string, string[]>();
  private stationPlatformIds = new Map<string, { id: string; sentido: string }[]>();

  selectedTrainId: string | null = null;
  hoveredTrainId: string | null = null;
  trainPanelX = 0;
  trainPanelY = 0;
  inspectedPlatformId: string | null = null;
  expandedPlatformDest: string | null = null;

  readonly peopleHistory: number[] = Array(40).fill(0);

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
    readonly viewport: CanvasViewportService,
    readonly clock: SimulationClockService,
    private readonly pathGeo: PathGeometryService,
    private readonly renderer: MetroRendererService,
    private readonly tileService: TileService,
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
          if (train) {
            const seg = this.metroData.paths.find(s => s.id === String(msg.anden));
            if (seg && seg.path.length >= 2) {
              const { path, segStart, segEnd } = this.pathGeo.buildCompositePath(seg);
              train.pathPoints    = path;
              train.pathArcLens   = computeArcLens(path);
              train.pathSegStart  = segStart;
              train.pathSegEnd    = segEnd;
              train.line = seg.line;
              train.capacity = (TRAIN_WAGONS[seg.line] ?? DEFAULT_WAGONS) * this.cfg.config.wagonCapacity;
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
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.metroData.paths) {
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
    const container = this.canvasContainer.nativeElement as HTMLElement;
    const nearTrain = this.findNearestTrain(e.x, e.y, 40);
    if (nearTrain) { container.style.cursor = 'pointer'; return; }
    const near = this.findNearestStation(e.x, e.y, 14);
    container.style.cursor = near >= 0 ? 'pointer' : 'grab';
  }

  onMapClick(e: { x: number; y: number }): void {
    this.handleMapClick(e.x, e.y);
  }

  onMapLeave(): void {
    this._mouseContainerX = -1;
    this._mouseContainerY = -1;
    (this.canvasContainer.nativeElement as HTMLElement).style.cursor = 'grab';
  }

  onMapResize(): void {
    this.resizeCanvases();
    this.needsStaticRedraw = true;
    this.needsTrainRedraw  = true;
  }

  // ── Zoom controls ────────────────────────────────────────────

  zoomIn(): void  { this.viewport.zoomAt(1.3,       this.canvasContainer.nativeElement.clientWidth / 2, this.canvasContainer.nativeElement.clientHeight / 2); this.needsStaticRedraw = true; this.needsTrainRedraw = true; }
  zoomOut(): void { this.viewport.zoomAt(1 / 1.3,   this.canvasContainer.nativeElement.clientWidth / 2, this.canvasContainer.nativeElement.clientHeight / 2); this.needsStaticRedraw = true; this.needsTrainRedraw = true; }

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
      this.updateStationsOverlay();
      this.updateTrainPanel();
      this.needsTrainRedraw = false;

      if (timestamp - this.lastCdTick >= 200) {
        this.lastCdTick = timestamp;
        this.peopleHistory.push(this.state.metroPeople());
        this.peopleHistory.shift();
        this.ngZone.run(() => {});
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

  private findNearestStation(cx: number, cy: number, hitPx = 14): number {
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

  private findNearestTrain(cx: number, cy: number, hitPx = 24): string | null {
    const scale = this.viewport.scale();
    const panX  = this.viewport.panX();
    const panY  = this.viewport.panY();
    let best: string | null = null;
    let bestDist = hitPx * hitPx;
    for (const t of this.state.trains()) {
      const tx = t.x * scale + panX;
      const ty = t.y * scale + panY;
      const d2 = (cx - tx) ** 2 + (cy - ty) ** 2;
      if (d2 < bestDist) { bestDist = d2; best = t.id; }
    }
    return best;
  }

  get selectedTrain() { return this.selectedTrainId ? this.state.getTrain(this.selectedTrainId) : undefined; }

  private handleMapClick(clientX: number, clientY: number): void {
    const rect = (this.canvasContainer.nativeElement as HTMLElement).getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const nearTrain = this.findNearestTrain(mx, my, 40);
    if (nearTrain) {
      this.selectedTrainId = nearTrain === this.selectedTrainId ? null : nearTrain;
      this.selectedStationIdx = -1;
      return;
    }

    const bestIdx = this.findNearestStation(mx, my);
    this.selectedStationIdx = bestIdx === this.selectedStationIdx ? -1 : bestIdx;
    this.selectedTrainId = null;
  }

  toggleShowAllPanels(): void {
    if (!this.showAllPanels) {
      this.showAllPanels   = true;
      this.stationsHidden  = false;
    } else {
      this.showAllPanels   = false;
      this.stationsHidden  = true;
    }
    this.applyOverlayClasses();
  }

  private applyOverlayClasses(): void {
    const el = this.stationsOverlay?.nativeElement as HTMLElement | undefined;
    if (!el) return;
    const fitMul    = this.viewport.scale() / this.viewport.fitScale();
    const forceShow = this.showAllPanels;
    const forceHide = this.stationsHidden;
    el.classList.toggle('show-interchange', !forceHide && (fitMul > 1.05 || forceShow));
    el.classList.toggle('show-all',         !forceHide && (fitMul > 1.7  || forceShow));
    el.classList.toggle('show-panel',       !forceHide && (fitMul > 15   || forceShow));
    el.classList.toggle('zoom-deep',        fitMul > 7);
  }

  private updateStationsOverlay(): void {
    this.applyOverlayClasses();
    const el = this.stationsOverlay?.nativeElement as HTMLElement | undefined;
    if (!el) return;
    if (!this._overlayElements) {
      const items = el.querySelectorAll<HTMLElement>('.stn-label-wrap');
      if (items.length > 0) this._overlayElements = Array.from(items);
    }
    if (this._overlayElements) {
      const stations = this.metroData.stations;
      const s = this.viewport.scale(), px = this.viewport.panX(), py = this.viewport.panY();
      for (let i = 0; i < this._overlayElements.length; i++) {
        const st = stations[i];
        if (!st) continue;
        this._overlayElements[i].style.left = (st.position.x * s + px) + 'px';
        this._overlayElements[i].style.top  = (st.position.y * s + py) + 'px';
      }
      if (this.selectedStationIdx !== this._lastSelectedIdx) {
        if (this._lastSelectedIdx >= 0) this._overlayElements[this._lastSelectedIdx]?.classList.remove('is-selected');
        if (this.selectedStationIdx >= 0) this._overlayElements[this.selectedStationIdx]?.classList.add('is-selected');
        this._lastSelectedIdx = this.selectedStationIdx;
      }
      const hoverIdx = this.findNearestStation(this._mouseContainerX, this._mouseContainerY, 14);
      if (hoverIdx !== this._lastHoveredIdx) {
        if (this._lastHoveredIdx >= 0) this._overlayElements[this._lastHoveredIdx]?.classList.remove('is-hover');
        if (hoverIdx >= 0) this._overlayElements[hoverIdx]?.classList.add('is-hover');
        this._hoveredStationIdx = hoverIdx;
        this._lastHoveredIdx = hoverIdx;
      }
    }
  }

  private updateTrainPanel(): void {
    this.hoveredTrainId = this.findNearestTrain(this._mouseContainerX, this._mouseContainerY, 40);
    if (!this.selectedTrainId) return;
    const t = this.state.getTrain(this.selectedTrainId);
    if (!t) { this.selectedTrainId = null; return; }
    this.trainPanelX = t.x * this.viewport.scale() + this.viewport.panX();
    this.trainPanelY = t.y * this.viewport.scale() + this.viewport.panY();
  }

  selectPerson(personId: string): void {
    this.state.trackPerson(personId);
    this.wsService.trackPerson(personId);
    this.wsService.resume();
  }

  togglePlatformInspect(anderId: string): void {
    if (this.inspectedPlatformId === anderId) {
      this.inspectedPlatformId = null;
      this.expandedPlatformDest = null;
      this.wsService.resume();
      return;
    }
    this.inspectedPlatformId = anderId;
    this.expandedPlatformDest = null;
    this.wsService.pause();
    this.wsService.requestPlatformPersons(anderId);
  }

  onStationLabelClick(idx: number): void {
    this.selectedStationIdx = idx === this.selectedStationIdx ? -1 : idx;
  }

  // Build a polyline following actual rail geometry for the person's planned path.
  // The first platform node's tramo goes FROM the origin station TO the next station —

  private buildStationLineMap(): void {
    this.stationLineMap.clear();
    this.stationPlatformIds.clear();
    const seen = new Map<string, Set<string>>();
    for (const p of this.metroData.paths) {
      const dirKey = p.line + '/' + p.sentido;
      if (!seen.has(p.name)) seen.set(p.name, new Set());
      if (!seen.get(p.name)!.has(dirKey)) {
        seen.get(p.name)!.add(dirKey);
        const lines = this.stationLineMap.get(p.name) ?? [];
        lines.push(p.line);
        this.stationLineMap.set(p.name, lines);
        const pids = this.stationPlatformIds.get(p.name) ?? [];
        pids.push({ id: p.id, sentido: p.sentido });
        this.stationPlatformIds.set(p.name, pids);
      }
    }
  }

  private drawStations(): void { this.renderer.drawStations(this.ctxStations); }

  private drawTrains(now: number): void {
    this.renderer.drawTrains(
      this.ctxTrains,
      this.state.trains(),
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
    for (const train of this.state.trains()) {
      if (train.travelMs > 0) {
        const elapsed = now - train.departedAt;
        if (elapsed < train.travelMs) {
          train.travelMs = elapsed + (train.travelMs - elapsed) * ratio;
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
    this.cd.markForCheck();
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

  get telemetrySegments(): number { return this.metroData.paths.length; }
  get telemetryStations(): number { return this.metroData.stations.length; }
  get telemetryUptime(): number   { return this.clock.uptime(); }

  get stationLabelItems() {
    const transitByName = new Map<string, number>();
    this.state.stationIdPeople().forEach((count, stationId) => {
      const s = this.metroData.stationsByCode.get(NodeId.parse(stationId)?.code ?? stationId);
      if (s) transitByName.set(s.name, (transitByName.get(s.name) ?? 0) + count);
    });

    return this.metroData.stations.map(s => {
      const lines       = this.stationLineMap.get(s.name) ?? [];
      const platformEntries = this.stationPlatformIds.get(s.name) ?? [];
      const platforms   = platformEntries.map((pe, idx) => {
        const line = lines[idx] ?? '';
        const destination = this.metroData.lineDestinations.get(`${line}/${pe.sentido}`) ?? '';
        return { id: pe.id, line, sentido: pe.sentido, destination,
                 total: this.state.andenPeople().get(parseInt(pe.id, 10)) ?? 0 };
      });
      const destCount = new Map<string, number>();
      platforms.forEach(p => destCount.set(p.destination, (destCount.get(p.destination) ?? 0) + 1));
      platforms.forEach(p => {
        if (p.destination && (destCount.get(p.destination) ?? 0) > 1)
          p.destination += ` ·${p.sentido}`;
      });
      const transit = transitByName.get(s.name) ?? 0;
      const total   = transit + platforms.reduce((sum, p) => sum + p.total, 0);
      return { name: s.name, x: s.position.x, y: s.position.y, lines, platforms, total, transit };
    });
  }

  get peakLabel(): string { return this.clock.peakLabel(); }
}
