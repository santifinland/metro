import { Directive, ElementRef, DestroyRef, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

@Directive({ selector: '[appMapInteraction]', standalone: true })
export class MapInteractionDirective {
  mapClick   = output<{ x: number; y: number }>();
  mapPan     = output<{ dx: number; dy: number }>();
  mapZoom    = output<{ factor: number; anchorX: number; anchorY: number }>();
  mapMove    = output<{ x: number; y: number }>();
  mapLeave   = output<void>();

  private readonly el     = inject(ElementRef<HTMLElement>);
  private readonly destroy = inject(DestroyRef);

  constructor() {
    const host = this.el.nativeElement;

    fromEvent<WheelEvent>(host, 'wheel', { passive: false })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(e => {
        e.preventDefault();
        this.mapZoom.emit({
          factor:  e.deltaY < 0 ? 1.12 : 1 / 1.12,
          anchorX: e.clientX,
          anchorY: e.clientY,
        });
      });

    let dragging  = false;
    let mouseMoved = false;
    let lastX = 0, lastY = 0;

    fromEvent<MouseEvent>(host, 'mousedown')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(e => {
        dragging = true; mouseMoved = false;
        lastX = e.clientX; lastY = e.clientY;
        host.style.cursor = 'grabbing';
      });

    fromEvent<MouseEvent>(host, 'mousemove')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(e => {
        const rect = host.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.mapMove.emit({ x, y });

        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (dx * dx + dy * dy > 64) mouseMoved = true;
        this.mapPan.emit({ dx, dy });
        lastX = e.clientX;
        lastY = e.clientY;
      });

    fromEvent<MouseEvent>(host, 'mouseup')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(e => {
        if (dragging && !mouseMoved) {
          const rect = host.getBoundingClientRect();
          this.mapClick.emit({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        dragging = false;
      });

    fromEvent<MouseEvent>(host, 'mouseleave')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        dragging = false;
        this.mapLeave.emit();
      });

    fromEvent(window, 'resize')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => host.dispatchEvent(new CustomEvent('map-resize')));
  }
}
