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
  };
  const mockSimulationStateService = {
    trains: [],
    simulationPeople: 0,
    metroPeople: 0,
    trainsPeople: 0,
    timeMultiplier: 1,
    dirty: false,
    platformsPeople: new Map<string, number>(),
    stationsPeople: new Map<string, number>(),
    initLines: jasmine.createSpy('initLines'),
    process: jasmine.createSpy('process'),
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

  it('should expose canvas dimensions', () => {
    expect(component.width).toBeGreaterThan(0);
    expect(component.height).toBeGreaterThan(0);
  });

  it('displayClock should return a time string', () => {
    const clock = component.displayClock();
    expect(clock).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('linePeople should return sorted entries', () => {
    mockSimulationStateService.platformsPeople.set('1', 10);
    mockSimulationStateService.platformsPeople.set('2', 30);
    const result = component.linePeople();
    expect(result[0][1]).toBeGreaterThanOrEqual(result[result.length - 1][1]);
  });

  it('allPeople should sum map values', () => {
    const map = new Map([['a', 5], ['b', 3]]);
    expect(component.allPeople(map)).toBe(8);
  });

  it('allPeople should return 0 for empty map', () => {
    expect(component.allPeople(new Map())).toBe(0);
  });

  it('lineColors should return a color string for known lines', () => {
    expect(component.lineColors('1')).toBeTruthy();
    expect(component.lineColors('1')).not.toBe('');
  });

  it('lineColors should return red for unknown lines', () => {
    expect(component.lineColors('999')).toBe('red');
  });
});
