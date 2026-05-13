import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UpperCasePipe } from '@angular/common';

import { SimulationStateService } from '../../services/simulation-state.service';
import { MetroDataService } from '../../services/metro-data.service';
import { WebSocketService } from '../../services/websocket.service';
import { NodeId } from '../../utils/node-id';

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
    const tracked = this.state.tracked();
    if (!tracked?.loc) return '';
    const { type: lt, id: lid } = tracked.loc;
    if (lt === 'station') {
      const code = NodeId.parse(lid)?.code ?? lid;
      return this.metroData.stationsByCode.get(code)?.name ?? code;
    }
    if (lt === 'platform') {
      return this.metroData.segments.find(p => p.id === lid)?.name ?? `andén ${lid}`;
    }
    if (lt === 'train') {
      const t = this.state.getTrain(lid);
      return t ? `tren L${t.line}` : 'tren';
    }
    return '';
  }

  get progress(): number {
    const tracked = this.state.tracked();
    if (!tracked?.loc) return 0;
    const nodes = tracked.nodes;
    const { type: lt, id: lid } = tracked.loc;
    if (!nodes.length) return 0;
    const nodeId = lt === 'station' ? lid : lt === 'platform' ? NodeId.platform(lid) : null;
    if (!nodeId) return 0;
    const idx = nodes.indexOf(nodeId);
    return idx < 0 ? 0 : Math.round((idx / (nodes.length - 1)) * 100);
  }

  stopTracking(): void {
    this.state.untrackPerson();
    this.wsService.untrackPerson();
  }
}
