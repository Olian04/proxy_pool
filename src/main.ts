const sym = Symbol('Proxy');
type ProxySign = { [sym]: void };
export type Proxy<V> = V & ProxySign;

type Ctx<T> = {
  data: T;
  isFree: boolean;
};

export enum PruneStrategy {
  /**
   * Will prune the pool on a fixed interval, given that the pool is at capacity.
   */
  ON_FIXED_INTERVAL = 'onFixedInterval',

  /**
   * Will prune the pool when a proxy is released and the free threshold is reached.
   */
  ON_USAGE_THRESHOLD = 'onUsageThreshold',

  /**
   * Will not prune the pool automatically.
   * The pool must be manually pruned by calling the `prune` method.
   */
  MANUAL = 'manual',
}

type PruneConfig =
  | {
      strategy: PruneStrategy.ON_FIXED_INTERVAL;

      /**
       * Amount of time in milliseconds between each prune attempt.
       */
      intervalMs: number;

      /**
       * The percentage of the pool that must be free for the pool to commence with the prune.
       */
      graceThreshold: number;
    }
  | {
      strategy: PruneStrategy.ON_USAGE_THRESHOLD;

      /**
       * The percentage of the pool that must be free before the pool will attempt a prune.
       */
      threshold: number;

      /**
       * Amount of time in milliseconds the pool will wait before commencing the prune.
       * Any usage of the pool that crosses the threshold during this period will abort the prune.
       */
      gracePeriodMs: number;
    }
  | {
      /**
       * Will not prune the pool automatically.
       * The pool must be manually pruned by calling the `prune` method.
       */
      strategy: PruneStrategy.MANUAL;
    };

const intervalCleanupRegistry = new FinalizationRegistry<NodeJS.Timeout>(
  clearInterval
);

export class ProxyPool<
  V extends Record<string | number | symbol, unknown>,
  T extends unknown[],
  K extends keyof V = keyof V
> {
  private accessors: ProxyHandler<Ctx<T>>;
  private ctxPool: Ctx<T>[] = [];
  private pool: V[] = [];
  private available: number = 0;
  private _capacity: number = 0;
  private config: {
    initialSize: number;
    maxSize: number;
    growthFactor: number;
    prune: PruneConfig;
  };
  private pruneGracePeriodTimeout: NodeJS.Timeout | null = null;

  constructor(
    accessors: {
      get: (...args: [...T, key: K]) => V[K];
      set: (...args: [...T, key: K, value: V[K]]) => boolean;
    },
    config?: {
      initialSize?: number;
      maxSize?: number;
      growthFactor?: number;
      prune?: PruneConfig;
    }
  ) {
    const {
      initialSize = 1000,
      maxSize = Infinity,
      growthFactor = 0.2,
      prune = {
        strategy: PruneStrategy.MANUAL,
      },
    } = config || {};
    this.config = {
      initialSize,
      maxSize,
      growthFactor,
      prune,
    };

    this.validateConfig();

    this.accessors = {
      get: (ctx, key) => accessors.get.call(null, ...ctx.data, key as K),
      set: (ctx, key, value) =>
        accessors.set.call(null, ...ctx.data, key as K, value),
    };

    if (this.config.initialSize > 0) {
      this.grow(this.config.initialSize);
    }

    if (this.config.prune.strategy === PruneStrategy.ON_FIXED_INTERVAL) {
      intervalCleanupRegistry.register(
        this,
        setInterval(() => this._prune(), this.config.prune.intervalMs)
      );
    }
  }

  private validateConfig() {
    if (this.config.initialSize <= 0) {
      throw new Error('Initial size must be greater than or equal to 0');
    }
    if (
      this.config.maxSize < 0 ||
      this.config.maxSize <= this.config.initialSize
    ) {
      throw new Error(
        'Max size must be greater than or equal to initial size and can not be zero'
      );
    }
    if (this.config.growthFactor < 0) {
      throw new Error('Growth factor must be greater than 0');
    }
    if (this.config.prune.strategy === PruneStrategy.ON_USAGE_THRESHOLD) {
      if (this.config.prune.threshold < 0) {
        throw new Error('Prune threshold must be greater than 0');
      }
      if (this.config.prune.gracePeriodMs < 0) {
        throw new Error('Grace period must be greater than 0');
      }
    }
    if (this.config.prune.strategy === PruneStrategy.ON_FIXED_INTERVAL) {
      if (this.config.prune.intervalMs < 0) {
        throw new Error('Interval must be greater than 0');
      }
      if (this.config.prune.graceThreshold < 0) {
        throw new Error('Grace threshold must be greater than 0');
      }
    }
  }

  private grow(by: number) {
    const toGrowBy = Math.max(
      0,
      Math.min(by, this.config.maxSize - this._capacity)
    );
    for (let index = 0; index < toGrowBy; index++) {
      this.ctxPool.push({
        data: null as unknown as T,
        isFree: true,
      });
      this.pool.push(
        new Proxy(
          this.ctxPool[this.ctxPool.length - 1],
          this.accessors
        ) as any as V
      );
    }
    this._capacity += toGrowBy;
    this.available += toGrowBy;
  }

  private _prune(): void {
    if (this._capacity <= this.config.initialSize) {
      return;
    }
    const newCapacity = Math.max(
      this.config.initialSize,
      Math.ceil(this.usedCapacity * (1 + this.config.growthFactor))
    );
    const ctxPool = Array(newCapacity).fill(0);
    const pool = Array(newCapacity).fill(0);
    let filled = 0;
    for (let index = 0; index < this._capacity; index++) {
      if (this.ctxPool[index].isFree) {
        continue;
      }
      ctxPool[filled] = this.ctxPool[index];
      pool[filled] = this.pool[index];
      filled += 1;
    }
    const used = filled;
    for (let index = 0; index < this._capacity; index++) {
      if (filled === newCapacity) {
        break;
      }
      if (!this.ctxPool[index].isFree) {
        continue;
      }
      ctxPool[filled] = this.ctxPool[index];
      pool[filled] = this.pool[index];
      filled += 1;
    }
    this.ctxPool = ctxPool;
    this.pool = pool;
    this._capacity = newCapacity;
    this.available = filled - used;
  }

  public prune(): void {
    if (this.config.prune.strategy !== PruneStrategy.MANUAL) {
      throw new Error(
        'Manual pruning requires the prune strategy to be set to `MANUAL`.'
      );
    }
    this._prune();
  }

  public get capacity() {
    return this._capacity;
  }

  public get usedCapacity() {
    return this._capacity - this.available;
  }

  public get availableCapacity() {
    return this.available;
  }

  public get(...args: T): Proxy<V>;
  public get() {
    if (this.available <= 0) {
      // Grow by G% when pool is at capacity
      this.grow(Math.ceil(this._capacity * this.config.growthFactor) + 1);
    }
    const index = this.ctxPool.findIndex((ctx) => ctx.isFree);
    this.ctxPool[index].isFree = false;
    this.ctxPool[index].data = arguments as any as T;
    this.available -= 1;
    return this.pool[index] as Proxy<V>;
  }

  public release(obj: Proxy<V>): void {
    const index = this.pool.findIndex((it) => it === obj);
    if (index < 0) {
      throw new Error('Attempting to release object not belonging to pool');
    }
    this.ctxPool[index].data = null as unknown as T;
    this.ctxPool[index].isFree = true;
    this.available += 1;

    if (this.config.prune.strategy === PruneStrategy.ON_USAGE_THRESHOLD) {
      if (this.available >= this.capacity * this.config.prune.threshold) {
        if (this.pruneGracePeriodTimeout) {
          clearTimeout(this.pruneGracePeriodTimeout);
        }
        this.pruneGracePeriodTimeout = setTimeout(
          () => this._prune(),
          this.config.prune.gracePeriodMs
        );
        intervalCleanupRegistry.register(this, this.pruneGracePeriodTimeout);
      }
    }
  }
}
