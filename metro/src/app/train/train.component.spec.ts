import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { TrainComponent } from './train.component';
import { WebSocketService } from '../services/websocket.service';
import { MetroDataService } from '../services/metro-data.service';
import { SimulationStateService } from '../services/simulation-state.service';

describe('TrainComponent', () => {
  let component: TrainComponent;
  let fixture: ComponentFixture<TrainComponent>;

  const mockMessages$ = new Subject();
  const mockWebSocketService = {
    messages$: mockMessages$.asObservable(),
    connectionStatus$: new Subject(),
  };
  const mockMetroDataService = {
    stations: [],
    paths: [],
    lineDestinations: new Map<string, string>(),
  };
  const mockSimulationStateService = {
    trains: [],
    simulationPeople: 0,
    metroPeople: 0,
    trainsPeople: 0,
    timeMultiplier: 1,
    dirty: false,
    paused: true,
    platformsPeople: new Map<string, number>(),
    stationsPeople: new Map<string, number>(),
    andenPeople: new Map<number, number>(),
    stationIdPeople: new Map<string, number>(),
    trackedPersonId: null,
    initLines: jasmine.createSpy('initLines'),
    process: jasmine.createSpy('process'),
    getTrain: jasmine.createSpy('getTrain'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainComponent],
      providers: [
        { provide: WebSocketService, useValue: mockWebSocketService },
        { provide: MetroDataService, useValue: mockMetroDataService },
        { provide: SimulationStateService, useValue: mockSimulationStateService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TrainComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call initLines on construction', () => {
    expect(mockSimulationStateService.initLines).toHaveBeenCalled();
  });

  it('should initialize with a valid fit scale', () => {
    expect(component.currentScale).toBeGreaterThan(0);
  });

  // ── displayClock ─────────────────────────────────────────────────────────

  it('displayClock should return a time string', () => {
    expect(component.displayClock()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('displayClock should format midnight correctly', () => {
    (component as any).time = 0;
    expect(component.displayClock()).toBe('00:00:00');
  });

  it('displayClock should format noon correctly', () => {
    (component as any).time = 12 * 3600 * 1000;
    expect(component.displayClock()).toBe('12:00:00');
  });

  it('displayClock should format 23:59:59 correctly', () => {
    (component as any).time = (23 * 3600 + 59 * 60 + 59) * 1000;
    expect(component.displayClock()).toBe('23:59:59');
  });

  // ── peakLabel ────────────────────────────────────────────────────────────

  it('peakLabel should return PEAK·AM during morning rush', () => {
    (component as any).time = 8 * 3600 * 1000;
    expect(component.peakLabel).toBe('PEAK · AM');
  });

  it('peakLabel should return PEAK·PM during evening rush', () => {
    (component as any).time = 18 * 3600 * 1000;
    expect(component.peakLabel).toBe('PEAK · PM');
  });

  it('peakLabel should return NIGHT after midnight', () => {
    (component as any).time = 2 * 3600 * 1000;
    expect(component.peakLabel).toBe('NIGHT');
  });

  it('peakLabel should return OFF·PEAK at midday', () => {
    (component as any).time = 13 * 3600 * 1000;
    expect(component.peakLabel).toBe('OFF · PEAK');
  });

  // ── fmtCount ─────────────────────────────────────────────────────────────

  it('fmtCount should return string for small numbers', () => {
    expect(component.fmtCount(0)).toBe('0');
    expect(component.fmtCount(999)).toBe('999');
  });

  it('fmtCount should format numbers >= 1000 with k', () => {
    expect(component.fmtCount(1000)).toBe('1.00k');
    expect(component.fmtCount(5500)).toBe('5.50k');
  });

  it('fmtCount should format numbers >= 10000 with one decimal k', () => {
    expect(component.fmtCount(10000)).toBe('10.0k');
    expect(component.fmtCount(25600)).toBe('25.6k');
  });

  // ── sparklinePoints ──────────────────────────────────────────────────────

  it('sparklinePoints should return a non-empty string', () => {
    const result = component.sparklinePoints([10, 20, 30, 20, 10]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('sparklinePoints should handle all-zero values without throwing', () => {
    expect(() => component.sparklinePoints(Array(40).fill(0))).not.toThrow();
  });

  it('sparklinePoints point count matches input length', () => {
    const values = [1, 2, 3, 4, 5];
    const points = component.sparklinePoints(values).split(' ');
    expect(points.length).toBe(5);
  });

  // ── lineColors ───────────────────────────────────────────────────────────

  it('lineColors should return a color string for known lines', () => {
    expect(component.lineColors('1')).toBeTruthy();
  });

  it('lineColors should return a fallback color for unknown lines', () => {
    expect(component.lineColors('999')).toBeTruthy();
  });

  // ── linePeople / allPeople ───────────────────────────────────────────────

  it('linePeople should return entries sorted by line name', () => {
    mockSimulationStateService.platformsPeople.set('2', 30);
    mockSimulationStateService.platformsPeople.set('1', 10);
    const result = component.linePeople();
    expect(result[0][0]).toBe('1');
    expect(result[1][0]).toBe('2');
  });

  it('allPeople should sum map values', () => {
    expect(component.allPeople(new Map([['a', 5], ['b', 3]]))).toBe(8);
  });

  it('allPeople should return 0 for empty map', () => {
    expect(component.allPeople(new Map())).toBe(0);
  });

  // ── linePercent ──────────────────────────────────────────────────────────

  it('linePercent should return 100 for the maximum value', () => {
    mockSimulationStateService.platformsPeople.clear();
    mockSimulationStateService.platformsPeople.set('1', 50);
    expect(component.linePercent(50)).toBe(100);
  });

  it('linePercent should return 0 when count is 0', () => {
    mockSimulationStateService.platformsPeople.clear();
    expect(component.linePercent(0)).toBe(0);
  });

  // ── telemetry getters ────────────────────────────────────────────────────

  it('telemetryStations should return station count', () => {
    expect(component.telemetryStations).toBe(0);
  });

  it('telemetrySegments should return path count', () => {
    expect(component.telemetrySegments).toBe(0);
  });

  it('telemetryTrains should return train count', () => {
    expect(component.telemetryTrains).toBe(0);
  });

  it('zoomReadout should contain ×', () => {
    expect(component.zoomReadout).toContain('×');
  });

  // ── toggleShowAllPanels ──────────────────────────────────────────────────

  it('toggleShowAllPanels first click should set showAllPanels to true', () => {
    component.toggleShowAllPanels();
    expect(component.showAllPanels).toBeTrue();
    expect((component as any).stationsHidden).toBeFalse();
  });

  it('toggleShowAllPanels second click should hide all and set stationsHidden', () => {
    component.toggleShowAllPanels();
    component.toggleShowAllPanels();
    expect(component.showAllPanels).toBeFalse();
    expect((component as any).stationsHidden).toBeTrue();
  });

  it('toggleShowAllPanels third click should show all again', () => {
    component.toggleShowAllPanels();
    component.toggleShowAllPanels();
    component.toggleShowAllPanels();
    expect(component.showAllPanels).toBeTrue();
    expect((component as any).stationsHidden).toBeFalse();
  });
});
