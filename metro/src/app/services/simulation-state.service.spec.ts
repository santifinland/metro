import { TestBed } from '@angular/core/testing';
import { SimulationStateService } from './simulation-state.service';

describe('SimulationStateService', () => {
  let service: SimulationStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulationStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty state', () => {
    expect(service.trains.length).toBe(0);
    expect(service.simulationPeople).toBe(0);
    expect(service.metroPeople).toBe(0);
    expect(service.trainsPeople).toBe(0);
    expect(service.dirty).toBeFalse();
  });

  it('initLines should populate platformsPeople and stationsPeople', () => {
    service.initLines(['1', '2', '3']);
    expect(service.platformsPeople.get('1')).toBe(0);
    expect(service.platformsPeople.get('2')).toBe(0);
    expect(service.stationsPeople.get('3')).toBe(0);
  });

  it('process newTrain should add a train and set dirty', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 100, y: 200 });
    expect(service.trains.length).toBe(1);
    expect(service.trains[0].id).toBe('T1');
    expect(service.dirty).toBeTrue();
  });

  it('process moveTrain should update target position and set dirty', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 0, y: 0 });
    service.dirty = false;
    service.process({ message: 'moveTrain', train: 'T1', x: 50, y: 75 });
    expect(service.trains[0].targetX).toBe(50);
    expect(service.trains[0].targetY).toBe(75);
    expect(service.dirty).toBeTrue();
  });

  it('process moveTrain for unknown train should not set dirty', () => {
    service.process({ message: 'moveTrain', train: 'UNKNOWN', x: 50, y: 75 });
    expect(service.dirty).toBeFalse();
  });

  it('process peopleInLinePlatforms should update platformsPeople', () => {
    service.initLines(['1']);
    service.process({ message: 'peopleInLinePlatforms', line: 'L1', people: 42 });
    expect(service.platformsPeople.get('1')).toBe(42);
  });

  it('process peopleInLineStations should update stationsPeople', () => {
    service.initLines(['2']);
    service.process({ message: 'peopleInLineStations', line: 'L2', people: 17 });
    expect(service.stationsPeople.get('2')).toBe(17);
  });

  it('process peopleInTrains should update trainsPeople', () => {
    service.process({ message: 'peopleInTrains', people: 99 });
    expect(service.trainsPeople).toBe(99);
  });

  it('process peopleInMetro should update metroPeople', () => {
    service.process({ message: 'peopleInMetro', people: 500 });
    expect(service.metroPeople).toBe(500);
  });

  it('process peopleInSimulation should update simulationPeople', () => {
    service.process({ message: 'peopleInSimulation', people: 1000 });
    expect(service.simulationPeople).toBe(1000);
  });

  it('process timeMultiplier should update timeMultiplier', () => {
    service.process({ message: 'timeMultiplier', multiplier: 5 });
    expect(service.timeMultiplier).toBe(5);
  });
});
