import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { WebSocketService, ConnectionStatus } from '../services/websocket.service';
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

  constructor(
    private readonly ws: WebSocketService,
    private readonly dialog: MatDialog,
  ) {}

  openConfig(): void {
    this.dialog.open(ConfigDialogComponent, { width: '420px' });
  }

  statusIcon(s: ConnectionStatus): string {
    return s === 'connected' ? 'wifi' : s === 'reconnecting' ? 'wifi_find' : 'wifi_off';
  }

  statusColor(s: ConnectionStatus): string {
    return s === 'connected' ? '#3fb950' : s === 'reconnecting' ? '#d29922' : '#f85149';
  }
}
