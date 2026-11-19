import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const DEFAULT_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
export const DEFAULT_SWEEP_API_BASE_URL = "http://localhost:3001";

export interface SweepResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
  skipped?: string;
}

type FetchFn = (
  url: string,
  init?: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

/**
 * Overdue-sweep scheduler (in-process interval — no paid scheduler, no SQS).
 *
 * Every SWEEP_INTERVAL_MS (default 15 min) it calls the API's automation
 * sweep endpoint, POST /api/v1/integrations/automations/sweep, which finds
 * tickets with no daily update in 3 days and evaluates `ticket.overdue`
 * rules. The `automation.run` job (JobsService) delegates here, so the
 * sweep runs both on the interval and when the job is enqueued.
 *
 * AUTH GAP (deliberate, documented — the sweep endpoint's auth is NOT
 * weakened): the endpoint is guarded by JwtAuthGuard + AUTOMATIONS_MANAGE,
 * and the token's tenant claim decides which tenant is swept, so the
 * worker needs an operator-provisioned JWT for a service user that holds
 * AUTOMATIONS_MANAGE in the tenant to sweep. Set it as SWEEP_API_TOKEN.
 * With no token the scheduler logs a warning and does nothing — the sweep
 * then only runs when an admin presses "Run overdue sweep" in the
 * Connections page. A real service-account scheme (one token per tenant,
 * or a service-auth header the API verifies) is a backend follow-up, not
 * a silent downgrade of the endpoint.
 *
 * Production replaces this interval with SQS/EventBridge (see
 * docs/INTEGRATIONS.md § Automations): the scheduler enqueues one
 * `automation.run` job per tenant instead of calling the API directly.
 */
@Injectable()
export class SweepSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SweepSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly fetchFn: FetchFn;

  constructor(
    private readonly config: ConfigService,
    fetchFn?: FetchFn,
  ) {
    // Injectable fetch so the spec can pass a stub; production uses global fetch.
    this.fetchFn = fetchFn ?? (fetch as unknown as FetchFn);
  }

  get apiBaseUrl(): string {
    return this.config.get<string>("SWEEP_API_BASE_URL") ?? DEFAULT_SWEEP_API_BASE_URL;
  }

  get intervalMs(): number {
    const raw = Number(this.config.get<string>("SWEEP_INTERVAL_MS"));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SWEEP_INTERVAL_MS;
  }

  get enabled(): boolean {
    return (this.config.get<string>("SWEEP_ENABLED") ?? "true") !== "false";
  }

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  /** Start the interval. No-op (with a warning) when disabled or tokenless. */
  start(): void {
    if (this.timer) return;
    if (!this.enabled) {
      this.logger.log("Overdue sweep scheduler disabled (SWEEP_ENABLED=false)");
      return;
    }
    if (!this.config.get<string>("SWEEP_API_TOKEN")) {
      this.logger.warn(
        "Overdue sweep scheduler NOT started: SWEEP_API_TOKEN is not set — " +
          "the sweep endpoint needs a JWT for a service user with AUTOMATIONS_MANAGE " +
          "(see SweepSchedulerService header). Set SWEEP_API_TOKEN to enable.",
      );
      return;
    }
    this.timer = setInterval(() => {
      void this.runSweepOnce().catch((err: unknown) => {
        this.logger.warn(`Overdue sweep tick failed: ${(err as Error).message}`);
      });
    }, this.intervalMs);
    // Don't keep the process alive for the timer alone.
    if (typeof this.timer.unref === "function") this.timer.unref();
    this.logger.log(
      `Overdue sweep scheduler started — POST ${this.apiBaseUrl}/api/v1/integrations/automations/sweep every ${this.intervalMs}ms`,
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** One sweep call. Never throws — failures are returned, never crash the worker. */
  async runSweepOnce(): Promise<SweepResult> {
    const token = this.config.get<string>("SWEEP_API_TOKEN");
    if (!token) {
      return { ok: false, skipped: "SWEEP_API_TOKEN is not set — sweep not attempted" };
    }
    const url = `${this.apiBaseUrl.replace(/\/$/, "")}/api/v1/integrations/automations/sweep`;
    try {
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = await res.text().catch(() => null);
      }
      if (!res.ok) {
        this.logger.warn(`Overdue sweep ${url} failed: HTTP ${res.status}`);
        return { ok: false, status: res.status, body };
      }
      this.logger.log(`Overdue sweep ${url} ok: ${JSON.stringify(body ?? null)}`);
      return { ok: true, status: res.status, body };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`Overdue sweep ${url} error: ${message}`);
      return { ok: false, error: message };
    }
  }
}
