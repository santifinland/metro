import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { WebSocketService } from '../services/websocket.service';
import { SimulationStateService } from '../services/simulation-state.service';
import { ConfigDialogComponent } from '../config-dialog/config-dialog.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  readonly status$ = this.ws.connectionStatus$;
  readonly sessionId = 'A' + Math.floor((Date.now() / 1000) % 9999).toString().padStart(4, '0');

  constructor(
    private readonly ws: WebSocketService,
    private readonly dialog: MatDialog,
    readonly state: SimulationStateService,
  ) {}

  openConfig(): void {
    this.dialog.open(ConfigDialogComponent, { width: '460px' });
  }
}
