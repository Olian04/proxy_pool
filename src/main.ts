const sym = Symbol('Proxy');
type ProxySign = { [sym]: void };
export type Proxy<V> = V & ProxySign;

type Ctx<T> = {
    data: T,
    isFree: boolean,
}

export class ProxyPool<T, V extends Record<string | number | symbol, unknown>> {
    private accessors: {
            get: <K extends keyof V>(ctx: Ctx<T>, key: K) => V[K], 
            set: <K extends keyof V>(ctx: Ctx<T>, key: K, value: V[K]) => boolean, 
    };
    private ctxPool: Ctx<T>[] = [];
    private pool: V[] = [];
    private available: number = 0;
    private _capacity: number = 0;
    private config: {
        initialSize: number,
        maxSize: number,
        growthFactor: number,
        pruneThreshold: number,
    };

    constructor(
        accessors: {
            get: <K extends keyof V>(data: T, key: K) => V[K], 
            set: <K extends keyof V>(data: T, key: K, value: V[K]) => boolean, 
        },
        config: {
            initialSize?: number,
            maxSize?: number,
            growthFactor?: number,
            pruneThreshold?: number,
        }
    ) {
        const {
            initialSize = 1000,
            maxSize = Infinity,
            growthFactor = 0.2,
            pruneThreshold = 0.75,
        } = config;
        this.config = {
            initialSize, maxSize, growthFactor, pruneThreshold
        }

        this.accessors = {
            get: ({ data }, key) => accessors.get(data, key),
            set: ({ data }, key, value) => accessors.set(data, key, value),
        };
        this.reset();
    }
    
    private reset() {
        this.pool = [];
        this.ctxPool = [];
        this.available = 0;
        this._capacity = 0;
        if (this.config.initialSize > 0) {
            this.grow(this.config.initialSize);
        }
    }

    private grow(by: number) {
        const toGrowBy = Math.max(0, Math.min(by, this.config.maxSize - this._capacity));
        for (let index = 0; index < toGrowBy; index++) {
            this.ctxPool.push({
                data: null as T,
                isFree: true,
            });
            this.pool.push(new Proxy(this.ctxPool[this.ctxPool.length - 1], this.accessors) as any as V);
        }
        this._capacity += toGrowBy;
        this.available += toGrowBy;
    }

    public prune() {
        if (this._capacity <= this.config.initialSize) {
            return;
        }
        const newCapacity = Math.max(this.config.initialSize, Math.ceil(this.usedCapacity * (1 + this.config.growthFactor)));
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

    public get capacity() {
        return this._capacity;
    }

    public get usedCapacity() {
        return this._capacity - this.available;
    }

    public get availableCapacity() {
        return this.available;
    }

    public get(data: T): Proxy<V> {
        if (this.available <= 0) {
            // Grow by G% when pool is at capacity
            this.grow(Math.ceil(this._capacity * this.config.growthFactor) + 1);
        }
        const index = this.ctxPool.findIndex(ctx => ctx.isFree);
        this.ctxPool[index].isFree = false;
        this.ctxPool[index].data = data;
        this.available -= 1;
        return this.pool[index] as Proxy<V>;
    }

    public release(obj: Proxy<V>) {
        const index = this.pool.findIndex(it => it === obj);
        if (index < 0) {
            throw new Error('Attempting to release object not belonging to pool')
        }
        this.ctxPool[index].data = null as T;
        this.ctxPool[index].isFree = true;
        this.available += 1;
    }
}
