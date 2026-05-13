import { Injectable } from '@angular/core';

import { TrackedPerson } from './simulation-state.service';
import { MetroDataService } from './metro-data.service';
import { Segment } from '../domain/segment';
import { NodeId } from '../utils/node-id';
import { computeArcLens } from '../utils/path-geometry';
import { CONNECT_SQ } from '../constants';

@Injectable({ providedIn: 'root' })
export class PathGeometryService {
  constructor(private readonly metroData: MetroDataService) {}

  buildCompositePath(
    seg: Segment,
  ): { path: { x: number; y: number }[]; segStart: number; segEnd: number } {
    const usedIds = new Set<string>([seg.id]);

    let prepended: { x: number; y: number }[] = [];
    let searchFrom = seg.path[0];
    for (let k = 0; k < 2; k++) {
      let best = CONNECT_SQ, prev: Segment | null = null;
      for (const s of this.metroData.segments) {
        if (s.line !== seg.line || s.sentido !== seg.sentido) continue;
        if (usedIds.has(s.id) || s.path.length < 2) continue;
        const e = s.path[s.path.length - 1];
        const d = (e.x - searchFrom.x) ** 2 + (e.y - searchFrom.y) ** 2;
        if (d < best) { best = d; prev = s; }
      }
      if (!prev) break;
      prepended  = [...prev.path.slice(0, -1), ...prepended];
      searchFrom = prev.path[0];
      usedIds.add(prev.id);
    }

    let appended: { x: number; y: number }[] = [];
    const segTail = seg.path[seg.path.length - 1];
    {
      let best = CONNECT_SQ, next: Segment | null = null;
      for (const s of this.metroData.segments) {
        if (s.line !== seg.line || s.sentido !== seg.sentido) continue;
        if (usedIds.has(s.id) || s.path.length < 2) continue;
        const d = (s.path[0].x - segTail.x) ** 2 + (s.path[0].y - segTail.y) ** 2;
        if (d < best) { best = d; next = s; }
      }
      if (next) { appended = next.path.slice(1); usedIds.add(next.id); }
    }

    const path     = [...prepended, ...seg.path, ...appended];
    const lens     = computeArcLens(path);
    const segStart = lens[prepended.length];
    const segEnd   = lens[prepended.length + seg.path.length - 1];
    return { path, segStart, segEnd };
  }

  buildPersonRailPath(nodes: string[]): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    for (const node of nodes) {
      if (!NodeId.isPlatform(node)) continue;
      const code = NodeId.parse(node)!.code;
      const tramo = this.metroData.segments.find(p => p.id === code);
      if (!tramo || tramo.path.length < 2) continue;
      if (points.length === 0) {
        points.push(...tramo.path);
      } else {
        const last  = points[points.length - 1];
        const first = tramo.path[0];
        const gap   = (last.x - first.x) ** 2 + (last.y - first.y) ** 2;
        if (gap < 25) {
          points.push(...tramo.path.slice(1));
        } else {
          points.push(tramo.path[tramo.path.length - 1]);
        }
      }
    }
    return points;
  }

  resolveNodeToPos(nodeName: string): { x: number; y: number } | null {
    const parsed = NodeId.parse(nodeName);
    if (parsed?.kind === 'station') {
      const s = this.metroData.stationsByCode.get(parsed.code);
      return s ? s.position : null;
    }
    if (parsed?.kind === 'platform') {
      const seg = this.metroData.segments.find(p => p.id === parsed.code);
      return seg ? seg.position : null;
    }
    return null;
  }

  resolveLocToPos(tracked: TrackedPerson | null): { x: number; y: number } | null {
    const loc = tracked?.loc;
    if (!loc) return null;
    if (loc.type === 'platform') {
      const seg = this.metroData.segments.find(p => p.id === loc.id);
      return seg ? seg.position : null;
    }
    if (loc.type === 'station') {
      const s = this.metroData.stationsByCode.get(NodeId.parse(loc.id)?.code ?? loc.id);
      return s ? s.position : null;
    }
    return null;
  }
}
