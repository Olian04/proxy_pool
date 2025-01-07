# proxy_pool

An object pool specifically for proxies

## Installation

```bash
npm install @olian04/proxy_pool
```

## Usage

```typescript
import { ProxyPool, Proxy } from '@olian04/proxy_pool';

const pool = new ProxyPool<
  Record<string, number>,
  [ctx: { foo: number }, num: number]
>({
  set: () => false,
  get: (data, num, key) => data.foo * num,
});

const obj = pool.get({ foo: 10 }, 2);
assert(obj.foo === 20);

const obj2 = pool.get({ foo: 20 }, 4);
assert(obj2.foo === 80);

pool.release(obj);
pool.release(obj2);
```
