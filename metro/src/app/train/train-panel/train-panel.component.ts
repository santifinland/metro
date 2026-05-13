import { Component, input, output } from '@angular/core';

import { LINE_COLORS } from '../../constants';
import { Train } from '../../train';
import { SimulationStateService } from '../../services/simulation-state.service';
import { MetroDataService } from '../../services/metro-data.service';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-train-panel',
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
  selectPerson = output<string>();

  inspectMode       = false;
  expandedTrainDest: string | null = null;

  constructor(
    readonly state: SimulationStateService,
    private readonly metroData: MetroDataService,
    private readonly wsService: WebSocketService,
  ) {}

  lineColors(line: string): string {
    return LINE_COLORS[line] ?? '#6b7488';
  }

  private resolveDestLabel(code: string): string {
    return this.metroData.stationsByCode.get(code)?.name ?? code;
  }

  groupByDest(persons: Array<{ id: string; destination: string }>): Array<{ destination: string; ids: string[] }> {
    const map = new Map<string, string[]>();
    for (const p of persons) {
      const label = this.resolveDestLabel(p.destination);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(p.id);
    }
    return Array.from(map.entries())
      .map(([destination, ids]) => ({ destination, ids }))
      .sort((a, b) => b.ids.length - a.ids.length);
  }

  inspectTrain(): void {
    const t = this.train();
    if (!t) return;
    this.wsService.send({ message: 'pause' });
    this.wsService.send({ message: 'requestTrainPersons', trainId: t.id } as any);
    this.inspectMode = true;
  }

  cancelInspect(): void {
    this.inspectMode = false;
    this.wsService.send({ message: 'resume' });
  }

  onSelectPerson(personId: string): void {
    this.inspectMode = false;
    this.selectPerson.emit(personId);
  }

  onClose(): void {
    this.inspectMode = false;
    this.close.emit();
  }
}
