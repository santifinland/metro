import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

import { Train } from '../../train';
import { SimulationStateService } from '../../services/simulation-state.service';
import { MetroDataService } from '../../services/metro-data.service';
import { WebSocketService } from '../../services/websocket.service';
import { lineColor, groupByDest } from '../../utils/format';

@Component({
  selector: 'app-train-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './train-panel.component.html',
  styleUrls: ['./train-panel.component.css'],
  host: {
    'class': 'train-panel',
    '[style.left.px]': 'panelX()',
    '[style.top.px]': 'panelY()',
  },
})
export class TrainPanelComponent {
  train    = input<Train | undefined>();
  panelX   = input.required<number>();
  panelY   = input.required<number>();

  close        = output<void>();
  selectPerson = output<{ personId: string; trainId: string }>();

  inspectMode       = false;
  expandedTrainDest: string | null = null;

  constructor(
    readonly state: SimulationStateService,
    private readonly metroData: MetroDataService,
    private readonly wsService: WebSocketService,
  ) {}

  lineColors(line: string): string { return lineColor(line); }

  groupByDest(persons: Array<{ id: string; destination: string }>): Array<{ destination: string; ids: string[] }> {
    return groupByDest(persons, code => this.metroData.stationsByCode.get(code)?.name ?? code);
  }

  inspectTrain(): void {
    const t = this.train();
    if (!t) return;
    this.wsService.pause();
    this.wsService.requestTrainPersons(t.id);
    this.inspectMode = true;
  }

  cancelInspect(): void {
    this.inspectMode = false;
    this.wsService.resume();
  }

  onSelectPerson(personId: string): void {
    this.inspectMode = false;
    this.selectPerson.emit({ personId, trainId: this.train()?.id ?? '' });
  }

  onClose(): void {
    this.inspectMode = false;
    this.close.emit();
  }
}
