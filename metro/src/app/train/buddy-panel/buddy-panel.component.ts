import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UpperCasePipe } from '@angular/common';

import { SimulationStateService } from '../../services/simulation-state.service';
import { SimulationClockService } from '../../services/simulation-clock.service';
import { MetroDataService } from '../../services/metro-data.service';
import { WebSocketService } from '../../services/websocket.service';
import { NodeId } from '../../utils/node-id';

interface StopItem { name: string; isCurrent: boolean; isTransfer: boolean; }

@Component({
  selector: 'app-buddy-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe],
  styleUrls: ['./buddy-panel.component.css'],
  host: { 'class': 'buddy-panel' },
  template: `
    <!-- ID -->
    <div class="bp-seg bp-seg-id">
      <span class="bp-live"></span>
      <div class="bp-seg-body">
        <span class="bp-label">TRACKING</span>
        <span class="bp-id">#{{ state.tracked()!.id.slice(0, 8) }}</span>
      </div>
    </div>

    <!-- Ubicación actual -->
    <div class="bp-seg bp-seg-loc">
      <div class="bp-seg-body">
        <span class="bp-label">UBICACIÓN</span>
        <div class="bp-loc-row">
          @if (state.tracked()?.loc?.type) {
            <span class="bp-badge" [class]="'bp-badge-' + state.tracked()!.loc!.type">
              {{ state.tracked()!.loc!.type | uppercase }}
            </span>
          }
          <span class="bp-loc-name">{{ locationLabel || '—' }}</span>
        </div>
      </div>
    </div>

    <!-- Trayecto -->
    <div class="bp-seg bp-seg-route">
      <div class="bp-seg-body">
        <span class="bp-label">TRAYECTO</span>
        <div class="bp-route">
          <span class="bp-origin">{{ origin || '—' }}</span>
          <span class="bp-arrow">→</span>
          <span class="bp-dest">{{ destination || '—' }}</span>
        </div>
      </div>
    </div>

    <!-- Tiempo + Progreso -->
    <div class="bp-seg bp-seg-progress">
      <div class="bp-seg-body">
        <div class="bp-prog-head">
          <span class="bp-label">PROGRESO</span>
          <span class="bp-elapsed">{{ elapsedDisplay }}</span>
        </div>
        <div class="bp-prog-row">
          <div class="bp-prog-track">
            <div class="bp-prog-fill" [style.width.%]="progress"></div>
          </div>
          <span class="bp-pct">{{ progress }}%</span>
        </div>
      </div>
    </div>

    <!-- Próximas paradas -->
    @if (upcomingStops.length) {
      <div class="bp-seg bp-seg-stops">
        <div class="bp-seg-body">
          <span class="bp-label">PRÓXIMAS</span>
          <div class="bp-stops">
            @for (stop of upcomingStops; track stop.name) {
              <span class="bp-stop" [class.bp-stop-current]="stop.isCurrent">
                <span class="bp-stop-dot"></span>
                {{ stop.name }}{{ stop.isTransfer ? ' ↔' : '' }}
              </span>
            }
          </div>
        </div>
      </div>
    }

    <!-- Acción -->
    <div class="bp-seg bp-seg-action">
      <button class="bp-btn-release" (click)="stopTracking()">LIBERAR</button>
    </div>
  `,
})
export class BuddyPanelComponent {
  private readonly startMs = this.clock.ms();

  constructor(
    readonly state: SimulationStateService,
    private readonly clock: SimulationClockService,
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

  get elapsedDisplay(): string {
    const tracked = this.state.tracked();
    const endMs = tracked?.arrivedAtMs ?? this.clock.ms();
    const elapsed = Math.max(0, endMs - this.startMs);
    const totalSec = Math.floor(elapsed / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
    return `${s}s`;
  }

  private get stationNodes(): Array<{ code: string; name: string }> {
    return (this.state.tracked()?.nodes ?? [])
      .filter(n => NodeId.isStation(n))
      .map(n => {
        const code = NodeId.parse(n)!.code;
        return { code, name: this.metroData.stationsByCode.get(code)?.name ?? code };
      });
  }

  get origin(): string { return this.stationNodes[0]?.name ?? ''; }
  get destination(): string {
    const ns = this.stationNodes;
    return ns.length > 1 ? ns[ns.length - 1].name : '';
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

  get upcomingStops(): StopItem[] {
    const tracked = this.state.tracked();
    if (!tracked?.nodes.length) return [];

    const nodes = tracked.nodes;
    const loc = tracked.loc;
    let startIdx = 0;
    if (loc) {
      const nodeId = loc.type === 'station' ? loc.id
        : loc.type === 'platform' ? NodeId.platform(loc.id) : null;
      if (nodeId) {
        const idx = nodes.indexOf(nodeId);
        if (idx >= 0) startIdx = idx;
      }
    }

    const lineForPlatform = new Map<string, string>();
    for (const n of nodes) {
      if (!NodeId.isPlatform(n)) continue;
      const code = NodeId.parse(n)!.code;
      const seg = this.metroData.segments.find(s => s.id === code);
      if (seg) lineForPlatform.set(n, seg.line);
    }

    const stops: StopItem[] = [];
    for (let i = startIdx; i < nodes.length && stops.length < 4; i++) {
      const n = nodes[i];
      if (!NodeId.isStation(n)) continue;
      const code = NodeId.parse(n)!.code;
      const name = this.metroData.stationsByCode.get(code)?.name ?? code;
      const isCurrent = i === startIdx && loc?.type === 'station';

      let prevLine = '';
      for (let k = i - 1; k >= 0; k--) {
        if (NodeId.isPlatform(nodes[k])) { prevLine = lineForPlatform.get(nodes[k]) ?? ''; break; }
      }
      let nextLine = '';
      for (let k = i + 1; k < nodes.length; k++) {
        if (NodeId.isPlatform(nodes[k])) { nextLine = lineForPlatform.get(nodes[k]) ?? ''; break; }
      }
      stops.push({ name, isCurrent, isTransfer: prevLine !== '' && nextLine !== '' && prevLine !== nextLine });
    }
    return stops;
  }

  stopTracking(): void {
    this.state.untrackPerson();
    this.wsService.untrackPerson();
  }
}
