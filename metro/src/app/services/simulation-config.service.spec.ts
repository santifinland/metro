import { TestBed } from '@angular/core/testing';
import { SimulationConfigService } from './simulation-config.service';

describe('SimulationConfigService', () => {
  let service: SimulationConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulationConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return defaults when localStorage is empty', () => {
    expect(service.config.wagonCapacity).toBe(100);
    expect(service.config.wagonsPerTrain).toBe(6);
    expect(service.config.trainsPerQuarterHour).toBe(4);
  });

  it('trainCapacity should be wagonCapacity × wagonsPerTrain', () => {
    expect(service.trainCapacity).toBe(600);
  });

  it('save should update config and persist to localStorage', () => {
    service.save({ wagonCapacity: 80, wagonsPerTrain: 8, trainsPerQuarterHour: 6 });
    expect(service.config.wagonCapacity).toBe(80);
    expect(service.trainCapacity).toBe(640);
    const stored = JSON.parse(localStorage.getItem('metro_sim_config')!);
    expect(stored.wagonsPerTrain).toBe(8);
  });

  it('should restore config from localStorage on init', () => {
    localStorage.setItem('metro_sim_config', JSON.stringify({ wagonCapacity: 50, wagonsPerTrain: 4, trainsPerQuarterHour: 3 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restored = TestBed.inject(SimulationConfigService);
    expect(restored.config.wagonCapacity).toBe(50);
    expect(restored.config.wagonsPerTrain).toBe(4);
  });
});
