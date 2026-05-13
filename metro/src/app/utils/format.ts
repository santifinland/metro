import { LINE_COLORS } from '../constants';

export function lineColor(line: string): string {
  return LINE_COLORS[line] ?? '#6b7488';
}

export function fmtCount(n: number): string {
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 10_000)  return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000)   return `${(n / 1000).toFixed(2)}k`;
  return String(n);
}

export function groupByDest<T extends { id: string; destination: string }>(
  persons: T[],
  resolveLabel: (code: string) => string,
): Array<{ destination: string; ids: string[] }> {
  const map = new Map<string, string[]>();
  for (const p of persons) {
    const label = resolveLabel(p.destination);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(p.id);
  }
  return Array.from(map.entries())
    .map(([destination, ids]) => ({ destination, ids }))
    .sort((a, b) => b.ids.length - a.ids.length);
}
