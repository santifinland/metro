import { Component } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { WebSocketService, ConnectionStatus } from '../services/websocket.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, NgIf, MatToolbarModule, MatIconModule, MatChipsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  readonly status$ = this.ws.connectionStatus$;

  constructor(private readonly ws: WebSocketService) {}

  statusIcon(s: ConnectionStatus): string {
    return s === 'connected' ? 'wifi' : s === 'reconnecting' ? 'wifi_find' : 'wifi_off';
  }

  statusColor(s: ConnectionStatus): string {
    return s === 'connected' ? '#4caf50' : s === 'reconnecting' ? '#ff9800' : '#f44336';
  }
}
