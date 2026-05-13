import { Component, ChangeDetectionStrategy, ViewEncapsulation, input, output, signal } from '@angular/core';

import { PersonEntry } from '../../messages';

@Component({
  selector: 'app-platform-inspect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./platform-inspect.component.css'],
  template: `
    <div class="platform-inspect">
      @if (persons(); as ps) {
        @for (group of groupByDest(ps); track group.destination) {
          <button class="train-dest-btn"
                  (mousedown)="$event.stopPropagation()"
                  (click)="toggleDest(group.destination)">
            <span class="train-dest-label">→ {{ group.destination || '?' }}</span>
            <span class="train-dest-count">{{ group.ids.length }}</span>
            <span class="train-dest-arrow">{{ expandedDest() === group.destination ? '▴' : '▾' }}</span>
          </button>
          @if (expandedDest() === group.destination) {
            @for (pid of group.ids; track pid) {
              <button class="train-person-btn"
                      (mousedown)="$event.stopPropagation()"
                      (click)="personSelect.emit(pid)">
                {{ pid.slice(0, 8) }}
              </button>
            }
          }
        }
        <button class="train-inspect-btn"
                (mousedown)="$event.stopPropagation()"
                (click)="closeInspect.emit()">
          CERRAR
        </button>
      } @else {
        <div class="platform-inspect-loading">cargando…</div>
      }
    </div>
  `,
})
export class PlatformInspectComponent {
  persons = input.required<PersonEntry[] | undefined>();

  closeInspect = output<void>();
  personSelect = output<string>();

  readonly expandedDest = signal<string | null>(null);

  toggleDest(dest: string): void {
    this.expandedDest.update(d => d === dest ? null : dest);
  }

  groupByDest(persons: PersonEntry[]): Array<{ destination: string; ids: string[] }> {
    const map = new Map<string, string[]>();
    for (const p of persons) {
      if (!map.has(p.destination)) map.set(p.destination, []);
      map.get(p.destination)!.push(p.id);
    }
    return Array.from(map.entries())
      .map(([destination, ids]) => ({ destination, ids }))
      .sort((a, b) => b.ids.length - a.ids.length);
  }
}
