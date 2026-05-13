import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

import { SimulationStateService } from '../../services/simulation-state.service';
import { SimulationConfigService } from '../../services/simulation-config.service';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-control-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'panel panel-left',
    '[class.panel--collapsed]': 'collapsed',
  },
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.css'],
})
export class ControlPanelComponent {
  clockDisplay  = input.required<string>();
  dayProgress   = input.required<number>();
  speed         = input.required<number>();
  speedPresets  = input.required<number[]>();
  speedIdx      = input.required<number>();
  resetTime     = input.required<string>();
  showSatellite = input.required<boolean>();
  zoomReadout   = input.required<string>();

  speedIdxChange  = output<number>();
  resetTimeChange = output<string>();
  satelliteToggle = output<void>();
  zoomIn          = output<void>();
  zoomOut         = output<void>();
  zoomReset       = output<void>();
  resetSim        = output<void>();

  collapsed = false;

  readonly gaugeCount = 16;

  constructor(
    readonly state: SimulationStateService,
    readonly cfg: SimulationConfigService,
    private readonly wsService: WebSocketService,
  ) {}

  gaugeCells(): string[] {
    const filled = Math.round(this.state.simLoad() * this.gaugeCount);
    return Array.from({ length: this.gaugeCount }, (_, i) => {
      if (i >= filled) return '';
      if (i >= 14) return 'over';
      if (i >= 11) return 'warn';
      return 'on';
    });
  }

  stepConfig(field: keyof typeof this.cfg.config, delta: number): void {
    const next = (this.cfg.config[field] as number) + delta;
    this.cfg.save({ ...this.cfg.config, [field]: next });
  }

  playPause(): void {
    if (this.state.paused()) {
      this.wsService.resume();
    } else {
      this.wsService.pause();
    }
  }

  setSpeedIdx(i: number): void {
    this.speedIdxChange.emit(i);
  }
}
