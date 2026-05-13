import { TestBed } from '@angular/core/testing';
import { SimulationStateService } from './simulation-state.service';

describe('SimulationStateService', () => {
  let service: SimulationStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulationStateService);
  });

  // ── creation ─────────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty state', () => {
    expect(service.trains().length).toBe(0);
    expect(service.simulationPeople()).toBe(0);
    expect(service.metroPeople()).toBe(0);
    expect(service.trainsPeople()).toBe(0);
    expect(service.paused()).toBeTrue();
  });

  it('getTrain should return undefined for unknown id', () => {
    expect(service.getTrain('UNKNOWN')).toBeUndefined();
  });

  // ── initLines ────────────────────────────────────────────────────────────

  it('initLines should populate platformsPeople and stationsPeople', () => {
    service.initLines(['1', '2', '3']);
    expect(service.platformsPeople().get('1')).toBe(0);
    expect(service.platformsPeople().get('2')).toBe(0);
    expect(service.stationsPeople().get('3')).toBe(0);
  });

  // ── reset ────────────────────────────────────────────────────────────────

  it('reset should clear trains', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 0, y: 0 });
    service.reset();
    expect(service.trains().length).toBe(0);
  });

  it('reset should clear people counts', () => {
    service.process({ message: 'peopleInMetro', people: 500 });
    service.reset();
    expect(service.metroPeople()).toBe(0);
    expect(service.simulationPeople()).toBe(0);
  });

  it('reset should clear tracked person', () => {
    service.trackPerson('p1');
    service.reset();
    expect(service.tracked()).toBeNull();
  });

  // ── newTrain ─────────────────────────────────────────────────────────────

  it('process newTrain should add a train', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 100, y: 200 });
    expect(service.trains().length).toBe(1);
    expect(service.trains()[0].id).toBe('T1');
  });

  it('process newTrain should upsert when train already exists', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 0, y: 0 });
    service.process({ message: 'newTrain', train: 'T1', x: 100, y: 200 });
    expect(service.trains().length).toBe(1);
    expect(service.getTrainView('T1')!.targetX).toBe(100);
  });

  it('getTrain should return train after newTrain', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 0, y: 0 });
    expect(service.getTrain('T1')).toBeDefined();
    expect(service.getTrain('T1')!.id).toBe('T1');
  });

  // ── moveTrain ────────────────────────────────────────────────────────────

  it('process moveTrain should update target position', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 0, y: 0 });
    service.process({ message: 'moveTrain', train: 'T1', x: 50, y: 75 });
    expect(service.getTrainView(service.trains()[0].id)!.targetX).toBe(50);
    expect(service.getTrainView(service.trains()[0].id)!.targetY).toBe(75);
  });

  it('process moveTrain for unknown train should not add it', () => {
    service.process({ message: 'moveTrain', train: 'UNKNOWN', x: 50, y: 75 });
    expect(service.trains().length).toBe(0);
  });

  // ── removeTrain ──────────────────────────────────────────────────────────

  it('process removeTrain should remove the train', () => {
    service.process({ message: 'newTrain', train: 'T1', x: 0, y: 0 });
    service.process({ message: 'removeTrain', train: 'T1' });
    expect(service.trains().length).toBe(0);
  });

  // ── people counts ─────────────────────────────────────────────────────────

  it('process peopleInLinePlatforms should update platformsPeople', () => {
    service.initLines(['1']);
    service.process({ message: 'peopleInLinePlatforms', line: 'L1', people: 42 });
    expect(service.platformsPeople().get('1')).toBe(42);
  });

  it('process peopleInLineStations should update stationsPeople', () => {
    service.initLines(['2']);
    service.process({ message: 'peopleInLineStations', line: 'L2', people: 17 });
    expect(service.stationsPeople().get('2')).toBe(17);
  });

  it('process peopleInPlatform should update andenPeople', () => {
    service.process({ message: 'peopleInPlatform', anden: 42, people: 15 });
    expect(service.andenPeople().get(42)).toBe(15);
  });

  it('process peopleInStation should update stationIdPeople', () => {
    service.process({ message: 'peopleInStation', stationId: 'Station_X_1', people: 7 });
    expect(service.stationIdPeople().get('Station_X_1')).toBe(7);
  });

  it('process peopleInTrains should update trainsPeople', () => {
    service.process({ message: 'peopleInTrains', people: 99 });
    expect(service.trainsPeople()).toBe(99);
  });

  it('process peopleInMetro should update metroPeople', () => {
    service.process({ message: 'peopleInMetro', people: 500 });
    expect(service.metroPeople()).toBe(500);
  });

  it('process peopleInSimulation should update simulationPeople', () => {
    service.process({ message: 'peopleInSimulation', people: 1000 });
    expect(service.simulationPeople()).toBe(1000);
  });

  // ── simulation state ──────────────────────────────────────────────────────

  it('process timeMultiplier should update timeMultiplier', () => {
    service.process({ message: 'timeMultiplier', multiplier: 5 });
    expect(service.timeMultiplier()).toBe(5);
  });

  it('process simPaused should update paused state', () => {
    service.process({ message: 'simPaused', paused: false });
    expect(service.paused()).toBeFalse();
    service.process({ message: 'simPaused', paused: true });
    expect(service.paused()).toBeTrue();
  });

  it('process simLoad should update load metrics', () => {
    service.process({ message: 'simLoad', load: 0.75, eventsPerTick: 12, queueSize: 3 });
    expect(service.simLoad()).toBe(0.75);
    expect(service.eventsPerTick()).toBe(12);
    expect(service.queueSize()).toBe(3);
  });

  // ── persons ──────────────────────────────────────────────────────────────

  it('process personsInTrain should update personsInTrain list', () => {
    service.process({ message: 'personsInTrain', train: 'T1', persons: [{ id: 'p1', destination: 'X' }] });
    expect(service.personsInTrain().length).toBe(1);
    expect(service.personsInTrain()[0].id).toBe('p1');
  });

  it('process personsInPlatform should store persons keyed by anderId', () => {
    service.process({ message: 'personsInPlatform', anderId: '42', persons: [{ id: 'p1', destination: 'Y' }] });
    expect(service.personsInPlatform().get('42')).toBeDefined();
    expect(service.personsInPlatform().get('42')![0].id).toBe('p1');
  });

  // ── person tracking ───────────────────────────────────────────────────────

  it('trackPerson should set tracked id', () => {
    service.trackPerson('p1');
    expect(service.tracked()?.id).toBe('p1');
    expect(service.tracked()?.nodes).toEqual([]);
    expect(service.tracked()?.loc).toBeNull();
  });

  it('untrackPerson should clear tracked', () => {
    service.trackPerson('p1');
    service.untrackPerson();
    expect(service.tracked()).toBeNull();
  });

  it('process personPath should update nodes when person matches', () => {
    service.trackPerson('p1');
    service.process({ message: 'personPath', person: 'p1', nodes: ['A', 'B', 'C'] });
    expect(service.tracked()?.nodes).toEqual(['A', 'B', 'C']);
  });

  it('process personPath should NOT update nodes when person does not match', () => {
    service.trackPerson('p1');
    service.process({ message: 'personPath', person: 'p2', nodes: ['X'] });
    expect(service.tracked()?.nodes).toEqual([]);
  });

  it('process personLocation should update location when person matches', () => {
    service.trackPerson('p1');
    service.process({ message: 'personLocation', person: 'p1', locType: 'station', locId: 'S1' });
    expect(service.tracked()?.loc?.type).toBe('station');
    expect(service.tracked()?.loc?.id).toBe('S1');
  });

  it('process personLocation should NOT update when person does not match', () => {
    service.trackPerson('p1');
    service.process({ message: 'personLocation', person: 'p2', locType: 'platform', locId: 'P1' });
    expect(service.tracked()?.loc).toBeNull();
  });

  // ── path query ────────────────────────────────────────────────────────────

  it('process pathResult should store the result', () => {
    service.process({ message: 'pathResult', found: true, from: 'A', to: 'B', nodes: [] });
    expect(service.pathQueryResult()).not.toBeNull();
    expect(service.pathQueryResult()!.found).toBeTrue();
  });

  it('pathQuerySummary should return empty string when no result', () => {
    expect(service.pathQuerySummary()).toBe('');
  });

  it('pathQuerySummary should describe a not-found result', () => {
    service.process({ message: 'pathResult', found: false, from: 'A', to: 'B', error: 'Station not found: B', nodes: [] });
    expect(service.pathQuerySummary()).toContain('not found');
  });

  it('pathQuerySummary should describe a found result with node count', () => {
    service.process({ message: 'pathResult', found: true, from: 'EMPALME', to: 'BATAN', nodes: [
      { kind: 'station', id: 'S1', label: 'EMPALME', line: '10a' },
      { kind: 'platform', id: 'P1', label: 'Platform 420', line: '10a' },
      { kind: 'station', id: 'S2', label: 'BATAN', line: '10a' },
    ]});
    const summary = service.pathQuerySummary();
    expect(summary).toContain('3 nodes');
    expect(summary).toContain('EMPALME');
  });

  // ── overcrowding ──────────────────────────────────────────────────────────

  it('process platformOvercrowded should not throw', () => {
    expect(() => service.process({ message: 'platformOvercrowded', platform: 'P1', people: 600 })).not.toThrow();
  });

  it('process stationOvercrowded should not throw', () => {
    expect(() => service.process({ message: 'stationOvercrowded', platform: 'S1', people: 1000 })).not.toThrow();
  });
});
