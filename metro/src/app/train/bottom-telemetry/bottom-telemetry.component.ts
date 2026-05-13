import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-bottom-telemetry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="telemetry" [style.--p]="(progress() * 100).toFixed(1) + '%'">
      <span class="telemetry-tag">▸ NET</span>
      <div class="telemetry-track"></div>
      <div class="telemetry-stat"><span class="k">TRAINS</span><span class="v">{{ trains() }}</span></div>
      <div class="telemetry-stat"><span class="k">SEGMENTS</span><span class="v">{{ segments() }}</span></div>
      <div class="telemetry-stat"><span class="k">STATIONS</span><span class="v">{{ stations() }}</span></div>
      <div class="telemetry-stat"><span class="k">UPTIME</span><span class="v">{{ uptime() }}m</span></div>
    </div>
  `,
})
export class BottomTelemetryComponent {
  trains   = input.required<number>();
  segments = input.required<number>();
  stations = input.required<number>();
  uptime   = input.required<number>();
  progress = input.required<number>();
}
