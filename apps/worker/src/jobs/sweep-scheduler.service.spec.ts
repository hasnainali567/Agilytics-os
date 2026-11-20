import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { JobsService } from "./jobs.service";
import { SweepSchedulerService } from "./sweep-scheduler.service";

/** Minimal ConfigService stand-in: get() reads a plain record. */
function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const SWEEP_URL = "http://localhost:3001/api/v1/integrations/automations/sweep";

function okFetch(body: unknown = { staleTickets: 0, evaluated: 0, outcomes: [] }) {
  return jest.fn(async (_url: string, _init?: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
}

// The service uses the global fetch; tests stub it here.
const originalFetch = globalThis.fetch;

function stubFetch(impl: (url: string, init?: unknown) => Promise<unknown>) {
  const fn = jest.fn(impl);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("SweepSchedulerService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("starts the interval and calls the sweep endpoint on every tick", async () => {
    const fetchFn = stubFetch(okFetch());
    const scheduler = new SweepSchedulerService(
      fakeConfig({ SWEEP_API_TOKEN: "svc-token", SWEEP_INTERVAL_MS: "1000" }),
    );
    scheduler.onModuleInit();
    expect(scheduler.isRunning).toBe(true);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith(
      SWEEP_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer svc-token" }),
      }),
    );
    scheduler.onModuleDestroy();
    expect(scheduler.isRunning).toBe(false);
    await jest.advanceTimersByTimeAsync(5000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not start without SWEEP_API_TOKEN (auth gap: no silent unauthenticated sweep)", () => {
    stubFetch(okFetch());
    const scheduler = new SweepSchedulerService(fakeConfig({ SWEEP_INTERVAL_MS: "1000" }));
    scheduler.onModuleInit();
    expect(scheduler.isRunning).toBe(false);
  });

  it("does not start when SWEEP_ENABLED=false", () => {
    stubFetch(okFetch());
    const scheduler = new SweepSchedulerService(
      fakeConfig({ SWEEP_API_TOKEN: "svc-token", SWEEP_ENABLED: "false" }),
    );
    scheduler.onModuleInit();
    expect(scheduler.isRunning).toBe(false);
  });

  it("runSweepOnce returns ok:false (never throws) when the API answers non-2xx", async () => {
    stubFetch(async (_url: string, _init?: unknown) => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
      text: async () => "Unauthorized",
    }));
    const scheduler = new SweepSchedulerService(fakeConfig({ SWEEP_API_TOKEN: "svc-token" }));
    await expect(scheduler.runSweepOnce()).resolves.toEqual(
      expect.objectContaining({ ok: false, status: 401 }),
    );
  });

  it("runSweepOnce skips (never throws) without a token", async () => {
    stubFetch(okFetch());
    const scheduler = new SweepSchedulerService(fakeConfig({}));
    await expect(scheduler.runSweepOnce()).resolves.toEqual(
      expect.objectContaining({ ok: false, skipped: expect.any(String) }),
    );
  });

  it("defaults the interval to 15 minutes and the API base to localhost:3001", () => {
    const scheduler = new SweepSchedulerService(fakeConfig({ SWEEP_API_TOKEN: "x" }));
    expect(scheduler.intervalMs).toBe(15 * 60 * 1000);
    expect(scheduler.apiBaseUrl).toBe("http://localhost:3001");
  });
});

describe("JobsService — automation.run delegates to the sweep scheduler", () => {
  it("calls runSweepOnce for automation.run and no-ops other jobs", async () => {
    const runSweepOnce = jest.fn(async () => ({ ok: true, status: 200, body: {} }));
    const scheduler = { runSweepOnce } as unknown as SweepSchedulerService;
    const jobs = new JobsService(scheduler);
    await jobs.process({ type: "automation.run", tenantId: "t1", payload: {} });
    expect(runSweepOnce).toHaveBeenCalledTimes(1);
    await jobs.process({ type: "ai.summary", tenantId: "t1", payload: {} });
    expect(runSweepOnce).toHaveBeenCalledTimes(1);
  });
});
