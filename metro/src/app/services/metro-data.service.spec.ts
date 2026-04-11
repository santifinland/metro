import { TestBed } from '@angular/core/testing';
import { MetroDataService } from './metro-data.service';

describe('MetroDataService', () => {
  let service: MetroDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MetroDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load stations', () => {
    expect(service.stations).toBeDefined();
    expect(service.stations.length).toBeGreaterThan(0);
  });

  it('should load paths', () => {
    expect(service.paths).toBeDefined();
    expect(service.paths.length).toBeGreaterThan(0);
  });

  it('stations should have name and position', () => {
    const station = service.stations[0];
    expect(station.name).toBeDefined();
    expect(station.position).toBeDefined();
    expect(typeof station.position.x).toBe('number');
    expect(typeof station.position.y).toBe('number');
  });

  it('paths should have line and path coordinates', () => {
    const path = service.paths[0];
    expect(path.line).toBeDefined();
    expect(path.path).toBeDefined();
    expect(path.path.length).toBeGreaterThan(0);
  });
});
