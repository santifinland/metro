import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SimulationConfig {
  wagonCapacity: number;
  wagonsPerTrain: number;
  trainsPerQuarterHour: number;
}

const STORAGE_KEY = 'metro_sim_config';

const DEFAULT_CONFIG: SimulationConfig = {
  wagonCapacity: 100,
  wagonsPerTrain: 6,
  trainsPerQuarterHour: 4,
};

@Injectable({ providedIn: 'root' })
export class SimulationConfigService {

  private readonly _config$ = new BehaviorSubject<SimulationConfig>(this.load());
  readonly config$ = this._config$.asObservable();

  get config(): SimulationConfig {
    return this._config$.value;
  }

  get trainCapacity(): number {
    const c = this._config$.value;
    return c.wagonCapacity * c.wagonsPerTrain;
  }

  save(config: SimulationConfig): void {
    this._config$.next(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  private load(): SimulationConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_CONFIG };
  }
}
