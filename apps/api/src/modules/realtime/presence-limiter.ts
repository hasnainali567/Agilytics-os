/**
 * Presence / typing rate limiter — drop, do not queue, excess pings
 * (docs/REALTIME.md §5: same posture as REST, tuned for events).
 * Per connection: at most `maxEvents` events per `windowMs`.
 */
export class PresenceRateLimiter {
  private readonly windowStart = new Map<string, { count: number; startedAt: number }>();

  constructor(
    private readonly maxEvents = 20,
    private readonly windowMs = 10_000,
  ) {}

  /** True when the event may be broadcast; false when it must be dropped. */
  allow(connectionId: string): boolean {
    const now = Date.now();
    const entry = this.windowStart.get(connectionId);
    if (!entry || now - entry.startedAt >= this.windowMs) {
      this.windowStart.set(connectionId, { count: 1, startedAt: now });
      return true;
    }
    if (entry.count >= this.maxEvents) return false;
    entry.count += 1;
    return true;
  }

  forget(connectionId: string): void {
    this.windowStart.delete(connectionId);
  }
}
