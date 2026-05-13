import { LruCache } from './lru-cache';

describe('LruCache', () => {
  it('stores and retrieves values', () => {
    const c = new LruCache<string, number>(3);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const c = new LruCache<string, number>(3);
    expect(c.get('x')).toBeUndefined();
  });

  it('evicts the least-recently-used entry when at capacity', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);  // should evict 'a'
    expect(c.has('a')).toBeFalse();
    expect(c.has('b')).toBeTrue();
    expect(c.has('c')).toBeTrue();
  });

  it('get bumps recency so accessed entry is not evicted first', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');     // bump 'a', so 'b' becomes LRU
    c.set('c', 3);  // should evict 'b'
    expect(c.has('b')).toBeFalse();
    expect(c.has('a')).toBeTrue();
  });

  it('size reflects current entry count', () => {
    const c = new LruCache<string, number>(5);
    c.set('x', 1);
    c.set('y', 2);
    expect(c.size).toBe(2);
  });
});
