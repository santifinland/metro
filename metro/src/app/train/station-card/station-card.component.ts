import { Component, ChangeDetectionStrategy, ViewEncapsulation, input, output } from '@angular/core';

import { PersonEntry } from '../../messages';
import { StationLabelItem } from '../station-label-item';
import { PlatformInspectComponent } from '../platform-inspect/platform-inspect.component';
import { lineColor, fmtCount } from '../../utils/format';

@Component({
  selector: 'app-station-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./station-card.component.css'],
  imports: [PlatformInspectComponent],
  template: `
    <div class="stn-label">
      <div class="stn-name"
           (mousedown)="$event.stopPropagation()"
           (click)="labelClick.emit()">
        <span class="stn-tick"></span>
        <span class="stn-text">{{ item().name }}</span>
      </div>
      <div class="stn-panel">
        <div class="stn-panel-row stn-total">
          <span class="k">TOTAL</span>
          <span class="v">{{ fmt(item().total) }}</span>
        </div>
        <div class="stn-panel-row stn-transit">
          <span class="k">↳ TRANSIT</span>
          <span class="v">{{ fmt(item().transit) }}</span>
        </div>
        <div class="stn-panel-sep">
          <span>{{ item().lines.length === 1 ? 'PLATFORM' : 'PLATFORMS · ' + item().lines.length }}</span>
        </div>
        @for (p of item().platforms; track p.id) {
          <div class="stn-platform">
            <span class="line-chip"
                  [style.background]="lineColor(p.line)"
                  [style.color]="p.line === 'R' ? '#000' : '#fff'">{{ p.line }}</span>
            <span class="stn-direction">→ {{ p.destination }}</span>
            <span class="stn-platform-count">{{ fmt(p.total) }}</span>
          </div>
          @if (inspectedPlatformId() !== p.id) {
            <button class="train-inspect-btn"
                    (mousedown)="$event.stopPropagation()"
                    (click)="platformInspect.emit(p.id)">
              INSPECCIONAR
            </button>
          }
          @if (inspectedPlatformId() === p.id) {
            <app-platform-inspect
              [persons]="personsInPlatform()?.get(p.id)"
              (closeInspect)="platformInspect.emit(p.id)"
              (personSelect)="personSelect.emit($event)" />
          }
        }
      </div>
    </div>
  `,
})
export class StationCardComponent {
  item               = input.required<StationLabelItem>();
  inspectedPlatformId = input<string | null>(null);
  personsInPlatform  = input<ReadonlyMap<string, PersonEntry[]> | null>(null);

  labelClick     = output<void>();
  platformInspect = output<string>();
  personSelect   = output<string>();

  lineColor = lineColor;
  fmt       = fmtCount;
}
