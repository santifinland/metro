import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UpperCasePipe } from '@angular/common';

import { SimulationStateService } from '../../services/simulation-state.service';
import { MetroDataService } from '../../services/metro-data.service';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-person-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe],
  templateUrl: './person-tracker.component.html',
  styleUrls: ['./person-tracker.component.css'],
  host: { 'class': 'person-tracker' },
})
export class PersonTrackerComponent {
  constructor(
    readonly state: SimulationStateService,
    private readonly metroData: MetroDataService,
    private readonly wsService: WebSocketService,
  ) {}

  get locationLabel(): string {
    const { trackedPersonLocType: lt, trackedPersonLocId: lid } = this.state;
    if (!lt || !lid) return '';
    if (lt === 'station') {
      const code = lid.replace('Station_', '');
      return this.metroData.stationsByCode.get(code)?.name ?? code;
    }
    if (lt === 'platform') {
      return this.metroData.paths.find(p => p.id === lid)?.name ?? `andén ${lid}`;
    }
    if (lt === 'train') {
      const t = this.state.getTrain(lid);
      return t ? `tren L${t.line}` : 'tren';
    }
    return '';
  }

  get progress(): number {
    const { trackedPersonLocType: lt, trackedPersonLocId: lid } = this.state;
    const nodes = this.state.trackedPersonNodes;
    if (!nodes.length || !lt || !lid) return 0;
    const nodeId = lt === 'station' ? lid : lt === 'platform' ? 'Platform_' + lid : null;
    if (!nodeId) return 0;
    const idx = nodes.indexOf(nodeId);
    return idx < 0 ? 0 : Math.round((idx / (nodes.length - 1)) * 100);
  }

  stopTracking(): void {
    this.state.trackedPersonId = null;
    this.wsService.send({ message: 'untrackPerson' } as any);
  }
}
