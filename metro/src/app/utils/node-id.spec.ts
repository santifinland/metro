import { NodeId } from './node-id';

describe('NodeId', () => {
  it('builds station id', () => {
    expect(NodeId.station('EMPALME_101')).toBe('Station_EMPALME_101');
  });

  it('builds platform id', () => {
    expect(NodeId.platform('420')).toBe('Platform_420');
  });

  it('isStation returns true for station ids', () => {
    expect(NodeId.isStation('Station_BATAN')).toBeTrue();
    expect(NodeId.isStation('Platform_1')).toBeFalse();
  });

  it('isPlatform returns true for platform ids', () => {
    expect(NodeId.isPlatform('Platform_42')).toBeTrue();
    expect(NodeId.isPlatform('Station_X')).toBeFalse();
  });

  it('parse returns station kind and code', () => {
    const r = NodeId.parse('Station_EMPALME_101');
    expect(r).toEqual({ kind: 'station', code: 'EMPALME_101' });
  });

  it('parse returns platform kind and code', () => {
    const r = NodeId.parse('Platform_420');
    expect(r).toEqual({ kind: 'platform', code: '420' });
  });

  it('parse returns null for malformed input', () => {
    expect(NodeId.parse('Unknown_X')).toBeNull();
    expect(NodeId.parse('')).toBeNull();
  });
});
