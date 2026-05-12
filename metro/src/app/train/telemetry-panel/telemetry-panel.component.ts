import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

import { LINE_COLORS } from '../../constants';
import { SimulationStateService } from '../../services/simulation-state.service';

@Component({
  selector: 'app-telemetry-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'panel panel-right',
    '[class.panel--collapsed]': 'collapsed',
  },
  templateUrl: './telemetry-panel.component.html',
  styleUrls: ['./telemetry-panel.component.css'],
})
export class TelemetryPanelComponent {
  peakLabel        = input.required<string>();
  peopleHistory    = input.required<number[]>();
  showAllPanels    = input.required<boolean>();

  toggleShowAllPanels = output<void>();

  collapsed = false;

  constructor(readonly state: SimulationStateService) {}

  formatCount(n: number): string {
    if (n >= 100_000) return `${Math.round(n / 1000)}k`;
    if (n >= 10_000)  return `${(n / 1000).toFixed(1)}k`;
    if (n >= 1_000)   return `${(n / 1000).toFixed(2)}k`;
    return String(n);
  }

  sparklinePoints(values: number[]): string {
    const w = 100, h = 22;
    const max = Math.max(...values, 1);
    return values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  }

  linePeople(): [string, number][] {
    return Array.from(this.state.platformsPeople.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
  }

  allPeople(recipient: Map<string, number>): number {
    const values = Array.from(recipient.values());
    return values.length === 0 ? 0 : values.reduce((p, c) => p + c);
  }

  linePercent(count: number): number {
    const max = Math.max(...Array.from(this.state.platformsPeople.values()), 1);
    return Math.round((count / max) * 100);
  }

  lineColors(line: string): string {
    return LINE_COLORS[line] ?? '#6b7488';
  }
}
