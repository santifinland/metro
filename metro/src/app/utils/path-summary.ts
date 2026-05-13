import { PathNode, PathResult } from '../messages';

export function pathQuerySummary(result: PathResult | null): string {
  if (!result) return '';
  if (!result.found) return `${result.from} → ${result.to}: not found — ${result.error ?? ''}`;
  const stations = result.nodes
    .filter((n: PathNode) => n.kind === 'station')
    .map((n: PathNode) => n.label);
  return `${result.from} → ${result.to}: ${result.nodes.length} nodes (stations: ${stations.join(' → ')})`;
}
