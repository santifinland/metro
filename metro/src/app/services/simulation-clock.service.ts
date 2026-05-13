import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SimulationClockService {
  private readonly _ms = signal(6 * 3600 * 1000);
  readonly ms = this._ms.asReadonly();

  readonly displayClock = computed(() =>
    new Date(this._ms()).toLocaleTimeString('en-GB', {
      timeZone: 'Etc/UTC', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  );

  readonly dayProgress = computed(() => (this._ms() % 86_400_000) / 86_400_000);

  readonly peakLabel = computed(() => {
    const h = (this._ms() / 3_600_000) % 24;
    if (h >= 7.5 && h < 9.5)  return 'PEAK · AM';
    if (h >= 17  && h < 19.5) return 'PEAK · PM';
    if (h < 6 || h > 23)      return 'NIGHT';
    return 'OFF · PEAK';
  });

  readonly uptime = computed(() => Math.floor(this._ms() / 60_000) % 999);

  advance(deltaRealMs: number, speedFactor: number): void {
    this._ms.update(ms => ms + deltaRealMs * speedFactor);
  }

  syncFromBackend(ms: number, driftThresholdMs = 5_000): void {
    if (Math.abs(this._ms() - ms) > driftThresholdMs) {
      this._ms.set(ms);
    }
  }

  resetTo(hhmm: string): void {
    const [h, m] = hhmm.split(':').map(Number);
    this._ms.set(((h || 6) * 3600 + (m || 0) * 60) * 1000);
  }
}
