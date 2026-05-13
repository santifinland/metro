import { TestBed } from '@angular/core/testing';
import { SimulationClockService } from './simulation-clock.service';

describe('SimulationClockService', () => {
  let svc: SimulationClockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(SimulationClockService);
  });

  it('starts at 06:00:00', () => {
    expect(svc.displayClock()).toBe('06:00:00');
  });

  it('advance moves time by deltaRealMs * speed', () => {
    svc.advance(1000, 2);
    expect(svc.ms()).toBe(6 * 3600 * 1000 + 2000);
  });

  it('resetTo parses hhmm correctly', () => {
    svc.resetTo('09:30');
    expect(svc.displayClock()).toBe('09:30:00');
  });

  it('resetTo defaults to 06:00 for 00:00 due to || fallback', () => {
    svc.resetTo('00:00');
    // 0 || 6 = 6, so this resets to 06:00:00
    expect(svc.displayClock()).toBe('06:00:00');
  });

  it('syncFromBackend ignores small drift', () => {
    const ms0 = svc.ms();
    svc.syncFromBackend(ms0 + 1000);
    expect(svc.ms()).toBe(ms0);
  });

  it('syncFromBackend accepts large drift', () => {
    svc.syncFromBackend(0, 100);
    expect(svc.ms()).toBe(0);
  });

  it('dayProgress is in [0, 1)', () => {
    const p = svc.dayProgress();
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
  });

  it('peakLabel returns PEAK · AM during morning rush', () => {
    svc['_ms'].set(8 * 3600 * 1000);
    expect(svc.peakLabel()).toBe('PEAK · AM');
  });

  it('peakLabel returns PEAK · PM during evening rush', () => {
    svc['_ms'].set(18 * 3600 * 1000);
    expect(svc.peakLabel()).toBe('PEAK · PM');
  });

  it('peakLabel returns NIGHT after midnight', () => {
    svc['_ms'].set(2 * 3600 * 1000);
    expect(svc.peakLabel()).toBe('NIGHT');
  });

  it('peakLabel returns OFF · PEAK at midday', () => {
    svc['_ms'].set(13 * 3600 * 1000);
    expect(svc.peakLabel()).toBe('OFF · PEAK');
  });
});
