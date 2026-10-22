/** Fixed-window per-key limiter. A request with no key is allowed (fail open) so one proxy cannot throttle everyone. */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private max: number, private windowMs: number, private now: () => number = Date.now) {}

  check(key: string | undefined): { ok: boolean; retryAfterSeconds: number } {
    if (!key) return { ok: true, retryAfterSeconds: 0 };
    const t = this.now();
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k);
    const e = this.hits.get(key);
    if (!e || e.reset <= t) {
      this.hits.set(key, { n: 1, reset: t + this.windowMs });
      return { ok: true, retryAfterSeconds: 0 };
    }
    e.n += 1;
    return e.n <= this.max ? { ok: true, retryAfterSeconds: 0 } : { ok: false, retryAfterSeconds: Math.ceil((e.reset - t) / 1000) };
  }
}
