import { ProxyPool, Proxy } from '../out.dev/main.js';

const pool = new ProxyPool<Record<number, number>, [ctx: { foo: number }]>(
  {
    set: () => false,
    get: (data, key) => data.foo * key,
  },
  {
    initialSize: 1,
  }
);

const startSize = 10 ** 2;
const testIterations = 7;

for (let testIteration = 0; testIteration < testIterations; testIteration++) {
  console.log('--------------------------------');
  console.log(`Test iteration ${testIteration}`);
  const testSize = startSize * 10 ** testIteration;

  console.log(`Proxy pool size: 10 ** ${2 + testIteration}`);
  const start = performance.now();
  const proxies: Proxy<Record<number, number>>[] = [];
  const ctx = {
    foo: 10,
    key: 0,
    value: 0,
    bar: 0,
    baz: 0,
    qux: 0,
    quux: 0,
    corge: 0,
    grault: 0,
    garply: 0,
    waldo: 0,
    fred: 0,
    plugh: 0,
    xyzzy: 0,
    thud: 0,
  };
  for (let i = 0; i < testSize; i++) {
    const obj = pool.get(ctx);
    pool.release(obj);
    proxies.push(obj);
  }
  const end = performance.now();
  const duration = end - start;
  console.log(duration);

  console.log(`Object allocation size: ${testSize}`);
  const start2 = performance.now();
  const objs: { foo: number }[] = [];
  for (let i = 0; i < testSize; i++) {
    const obj = {
      foo: 10,
      key: i,
      value: i,
      bar: i,
      baz: i,
      qux: i,
      quux: i,
      corge: i,
      grault: i,
      garply: i,
      waldo: i,
      fred: i,
      plugh: i,
      xyzzy: i,
      thud: i,
    };
    objs.push(obj);
  }
  const end2 = performance.now();
  const duration2 = end2 - start2;
  console.log(duration2);
}
