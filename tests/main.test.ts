import { describe, it } from 'vitest';

import { ProxyPool, Proxy } from '../out.dev/main.js';

describe('ProxyPool', () => {
  it('should create a pool', ({ expect }) => {
    const pool = new ProxyPool<Record<number, number>, [ctx: { foo: number }]>(
      {
        set: () => false,
        get: (data, key) => data.foo * key,
      },
      {
        initialSize: 1,
      }
    );

    expect(pool).toBeDefined();
    expect(pool.capacity).toBe(1);
    expect(pool.usedCapacity).toBe(0);
  });

  it('should be able to get and set properties on proxy', ({ expect }) => {
    const ctx = { foo: 10 };
    const pool = new ProxyPool<typeof ctx, [ctx: typeof ctx]>({
      set: (data, key, value) => {
        data[key] = value;
        return true;
      },
      get: (data, key) => data[key],
    });

    const obj = pool.get(ctx);
    expect(obj).toBeDefined();
    expect(obj.foo).toBe(10);
    obj.foo = 20;
    expect(obj.foo).toBe(20);
  });

  it('should be able to accept multiple arguments', ({ expect }) => {
    const pool = new ProxyPool<
      Record<string, number>,
      [ctx: { foo: number }, num: number]
    >(
      {
        set: () => false,
        get: (data, num, key) => data.foo * num,
      },
      {
        initialSize: 1,
      }
    );

    const obj = pool.get({ foo: 10 }, 2);
    expect(obj).toBeDefined();
    expect(obj.foo).toBe(20);
  });

  it('should grow the pool', ({ expect }) => {
    const pool = new ProxyPool<Record<number, number>, [ctx: { foo: number }]>(
      {
        set: () => false,
        get: (data, key) => data.foo * key,
      },
      {
        initialSize: 1,
      }
    );
    expect(pool.capacity).toBe(1);
    expect(pool.usedCapacity).toBe(0);

    const ctx = { foo: 10 };
    const objects: Proxy<Record<number, number>>[] = [];
    for (let i = 0; i < 15; i++) {
      objects.push(pool.get(ctx));
    }
    expect(pool.capacity).toBe(17);
    expect(pool.usedCapacity).toBe(15);
  });

  it('should release objects', ({ expect }) => {
    const pool = new ProxyPool<Record<number, number>, [ctx: { foo: number }]>(
      {
        set: () => false,
        get: (data, key) => data.foo * key,
      },
      {
        initialSize: 1,
      }
    );

    const ctx = { foo: 10 };
    const objects: Proxy<Record<number, number>>[] = [];
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
    const pool = new ProxyPool<Record<number, number>, [ctx: { foo: number }]>(
      {
        set: () => false,
        get: (data, key) => data.foo * key,
      },
      {
        initialSize: 1,
      }
    );

    const ctx = { foo: 10 };
    const objects: Proxy<Record<number, number>>[] = [];
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
    const pool = new ProxyPool<Record<number, number>, [ctx: { foo: number }]>(
      {
        set: () => false,
        get: (data, key) => data.foo * key,
      },
      {
        initialSize: 2,
      }
    );

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

  /* Was faster on windows, but not on mac
  it('should be faster than object allocation', ({ expect }) => {
    const testSize = 10 ** 7;

    const pool = new ProxyPool<Record<number, null>, [ctx: { foo: number }]>({
      set: () => false,
      get: () => null,
    });

    const proxyStart = performance.now();
    const proxies: Proxy<any>[] = [];
    const ctx = { foo: 10 };
    for (let i = 0; i < testSize; i++) {
      const obj = pool.get(ctx);
      pool.release(obj);
      proxies.push(obj);
    }
    const proxyDuration = performance.now() - proxyStart;

    const objStart = performance.now();
    const objs: { foo: number }[] = [];
    for (let i = 0; i < testSize; i++) {
      const obj = { foo: 10 };
      objs.push(obj);
    }
    const objDuration = performance.now() - objStart;

    expect(proxyDuration).toBeLessThan(objDuration);
  });
  */
});
