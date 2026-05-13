import { lineColor, fmtCount, groupByDest } from './format';

describe('lineColor', () => {
  it('returns color for known line', () => {
    expect(lineColor('1')).toBe('#0097C9');
  });

  it('returns fallback for unknown line', () => {
    expect(lineColor('L99')).toBe('#6b7488');
  });
});

describe('fmtCount', () => {
  it('returns plain number for small values', () => {
    expect(fmtCount(0)).toBe('0');
    expect(fmtCount(999)).toBe('999');
  });

  it('formats thousands with two decimals', () => {
    expect(fmtCount(1000)).toBe('1.00k');
    expect(fmtCount(5500)).toBe('5.50k');
  });

  it('formats 10k range with one decimal', () => {
    expect(fmtCount(10000)).toBe('10.0k');
    expect(fmtCount(50000)).toBe('50.0k');
  });

  it('formats 100k range rounded', () => {
    expect(fmtCount(100000)).toBe('100k');
    expect(fmtCount(150000)).toBe('150k');
  });
});

describe('groupByDest', () => {
  const persons = [
    { id: 'p1', destination: 'A' },
    { id: 'p2', destination: 'B' },
    { id: 'p3', destination: 'A' },
  ];

  it('groups persons by resolved destination label', () => {
    const result = groupByDest(persons, code => code.toLowerCase());
    expect(result.find(g => g.destination === 'a')?.ids.sort()).toEqual(['p1', 'p3']);
    expect(result.find(g => g.destination === 'b')?.ids).toEqual(['p2']);
  });

  it('sorts groups by descending count', () => {
    const result = groupByDest(persons, code => code);
    expect(result[0].destination).toBe('A');
  });
});
