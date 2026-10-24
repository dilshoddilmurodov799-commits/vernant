/**
 * Fixed-window attempt counter held in memory. It is per server instance: with several
 * instances or serverless hosting it only slows abuse per instance, so Supabase Auth's own
 * limits stay the backstop (see README). Dependency-free for tests.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** Records one attempt. Returns 0 when allowed, otherwise the seconds until the window resets. */
  hit(key: string, now = Date.now()): number {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size >= this.maxKeys) this.prune(now);
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return 0;
    }
    if (entry.count >= this.limit) return Math.ceil((entry.resetAt - now) / 1000);
    entry.count++;
    return 0;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    // Still full: drop the oldest windows (a Map iterates in insertion order).
    for (const key of this.hits.keys()) {
      if (this.hits.size < this.maxKeys) break;
      this.hits.delete(key);
    }
  }
}
