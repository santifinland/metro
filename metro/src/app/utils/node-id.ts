export type NodeKind = 'station' | 'platform';
export interface ParsedNode { kind: NodeKind; code: string; }

export const NodeId = {
  station: (code: string) => `Station_${code}`,
  platform: (id: string) => `Platform_${id}`,
  isStation: (s: string) => s.startsWith('Station_'),
  isPlatform: (s: string) => s.startsWith('Platform_'),
  parse(s: string): ParsedNode | null {
    if (s.startsWith('Station_'))  return { kind: 'station',  code: s.slice('Station_'.length) };
    if (s.startsWith('Platform_')) return { kind: 'platform', code: s.slice('Platform_'.length) };
    return null;
  },
};
