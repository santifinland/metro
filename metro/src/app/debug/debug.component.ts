import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

import { WebSocketService } from '../services/websocket.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { PathNode } from '../messages';

@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './debug.component.html',
  styleUrls: ['./debug.component.css'],
})
export class DebugComponent {
  from = '';
  to   = '';

  constructor(
    private readonly ws: WebSocketService,
    readonly state: SimulationStateService,
  ) {}

  /** Send a queryPath request to the backend. */
  query(): void {
    if (this.from.trim() && this.to.trim()) {
      this.state.queryPath(this.ws, this.from.trim(), this.to.trim());
    }
  }

  /** Separate the returned nodes into station-only rows for the summary line. */
  stationLabels(): string {
    const r = this.state.pathQueryResult;
    if (!r?.found) return '';
    return r.nodes
      .filter((n: PathNode) => n.kind === 'station')
      .map((n: PathNode) => n.label)
      .join(' → ');
  }
}
