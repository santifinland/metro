import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import Panzoom from '@panzoom/panzoom';

import { WebSocketService } from '../services/websocket.service';
import { MetroDataService } from '../services/metro-data.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { Station } from '../station';
import { Train } from '../train';
import { CANVAS_WIDTH, CANVAS_HEIGHT, REDRAW_PERIOD_MS, LINE_COLORS } from '../constants';

@Component({
  selector: 'app-train',
  standalone: true,
  imports: [NgFor, NgIf, MatCardModule, MatIconModule, MatProgressBarModule],
  templateUrl: './train.component.html',
  styleUrls: ['./train.component.css']
})
export class TrainComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvas_stations', { static: false, read: ElementRef }) canvasStations!: ElementRef;
  @ViewChild('canvas_paths', { static: false, read: ElementRef }) canvasPaths!: ElementRef;
  @ViewChild('canvas_trains', { static: false, read: ElementRef }) canvasTrains!: ElementRef;

  private ctxStations!: CanvasRenderingContext2D;
  private ctx!: CanvasRenderingContext2D;
  private ctxTrains!: CanvasRenderingContext2D;

  readonly width = CANVAS_WIDTH;
  readonly height = CANVAS_HEIGHT;

  panelCollapsed = false;

  private time = 6 * 3600 * 1000;
  private lastClockAdvance = 0;
  private rafId = 0;
  private readonly destroy$ = new Subject<void>();
  private destroyed = false;

  constructor(
    private readonly wsService: WebSocketService,
    readonly metroData: MetroDataService,
    readonly state: SimulationStateService,
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
    const panzoomStations = Panzoom(this.canvasStations.nativeElement, { maxScale: 10, canvas: true, step: 0.2 });
    const panzoom = Panzoom(this.canvasPaths.nativeElement, { maxScale: 10, canvas: true, step: 0.2 });
    const panzoomTrains = Panzoom(this.canvasTrains.nativeElement, { maxScale: 10, canvas: true, step: 0.2 });

    this.canvasTrains.nativeElement.parentElement.addEventListener('wheel', (event: any) => {
      if (!event.shiftKey) return;
      const pan = panzoomTrains.getPan();
      panzoomStations.zoomWithWheel(event);
      panzoomTrains.zoomWithWheel(event);
      panzoom.zoomWithWheel(event);
      panzoom.pan(pan.x, pan.y);
      panzoomStations.pan(pan.x, pan.y);
      panzoomTrains.pan(pan.x, pan.y);
    });
  }

  private drawStations(ctx: CanvasRenderingContext2D, stations: Station[]): void {
    ctx.font = '8px Verdana';
    for (const station of stations) {
      ctx.lineWidth = 0.6;
      ctx.strokeText(station.name, station.position.x + 7, station.position.y + 3);
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.arc(station.position.x, station.position.y, 5, 0, Math.PI * 2, true);
      ctx.fillStyle = 'white';
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
