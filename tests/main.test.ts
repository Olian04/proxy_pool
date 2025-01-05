import { describe, it } from 'vitest';

import { ProxyPool, Proxy } from '../out.dev/main.js';

describe('ProxyPool', () => {
  it('should create a pool', ({ expect }) => {
    const pool = new ProxyPool<{ foo: number }, Record<number, number>>({ 
      set: () => false,
      get: (data, key) => data.foo * key,
    }, {
      initialSize: 1,
    });

    expect(pool).toBeDefined();
    expect(pool.capacity).toBe(1);
    expect(pool.usedCapacity).toBe(0);
  });

  it('should grow the pool', ({ expect }) => {
    const pool = new ProxyPool<{ foo: number }, Record<number, number>>({ 
      set: () => false,
      get: (data, key) => data.foo * key,
    }, {
      initialSize: 1,
    });
    expect(pool.capacity).toBe(1);
    expect(pool.usedCapacity).toBe(0);

    const ctx = { foo: 10 };
    const objects: Proxy<Record<number, number>>[] = []
    for (let i = 0; i < 15; i++) {
      objects.push(pool.get(ctx));
    }
    expect(pool.capacity).toBe(17);
    expect(pool.usedCapacity).toBe(15);
  });

  it('should release objects', ({ expect }) => {
    const pool = new ProxyPool<{ foo: number }, Record<number, number>>({ 
      set: () => false,
      get: (data, key) => data.foo * key,
    }, {
      initialSize: 1,
    });

    const ctx = { foo: 10 };
    const objects: Proxy<Record<number, number>>[] = []
    for (let i = 0; i < 15; i++) {
      objects.push(pool.get(ctx));
    }
    for (const obj of objects) {
      pool.release(obj);
    }
    expect(pool.capacity).toBe(17);
    expect(pool.usedCapacity).toBe(0);
  });

  it('should prune the pool', ({ expect }) => {
    const pool = new ProxyPool<{ foo: number }, Record<number, number>>({ 
      set: () => false,
      get: (data, key) => data.foo * key,
    }, {
      initialSize: 1,
    });

    const ctx = { foo: 10 };
    const objects: Proxy<Record<number, number>>[] = []
    for (let i = 0; i < 15; i++) {
      objects.push(pool.get(ctx));
    }
    for (const obj of objects) {
      pool.release(obj);
    }
    pool.prune();
    expect(pool.capacity).toBe(1);
    expect(pool.usedCapacity).toBe(0);
  });

  it('should resuse objects', ({ expect }) => {
    const pool = new ProxyPool<{ foo: number }, Record<number, number>>({ 
      set: () => false,
      get: (data, key) => data.foo * key,
    }, {
      initialSize: 2,
    });

    const ctx = { foo: 10 };
    const first = pool.get(ctx);
    const second = pool.get(ctx);
    pool.release(first);
    pool.release(second);
    for (let i = 0; i < 15; i++) {
      const obj = pool.get(ctx);
      const obj2 = pool.get(ctx);
      expect(obj).toBe(first);
      expect(obj2).toBe(second);
      pool.release(obj);
      pool.release(obj2);
    }
  });
});
