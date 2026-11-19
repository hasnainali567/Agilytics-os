import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { AdminService } from "./admin.service";

describe("AdminService.systemHealth", () => {
  let service: AdminService;
  let queryRaw: ReturnType<typeof jest.fn>;
  let groupBy: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    queryRaw = jest.fn(() => Promise.resolve([{ "?column?": 1 }]));
    groupBy = jest.fn(() =>
      Promise.resolve([
        { provider: "SLACK", _count: { _all: 2 } },
        { provider: "GITHUB", _count: { _all: 1 } },
      ]),
    );
    const prisma = { $queryRaw: queryRaw, integration: { groupBy } } as never;
    service = new AdminService(prisma);
  });

  it("reports ok with a DB ping latency and per-provider integration counts", async () => {
    const health = await service.systemHealth();
    expect(health.status).toBe("ok");
    expect(health.service).toBe("agilytics-os-api");
    expect(health.database.ok).toBe(true);
    expect(typeof health.database.latencyMs).toBe("number");
    expect(health.integrations).toEqual({
      total: 3,
      providers: { SLACK: 2, GITHUB: 1 },
    });
    // No secrets or credentials ever leak through the health endpoint.
    expect(JSON.stringify(health)).not.toMatch(/secret|token|credential/i);
  });

  it("degrades (does not throw) when the DB ping fails", async () => {
    queryRaw.mockImplementation(() => Promise.reject(new Error("connection refused")));
    const health = await service.systemHealth();
    expect(health.status).toBe("degraded");
    expect(health.database.ok).toBe(false);
    expect(health.database.error).toMatch(/connection refused/);
    // Integration counts are still attempted and reported.
    expect(health.integrations.total).toBe(3);
  });

  it("reports the integration error instead of throwing when groupBy fails", async () => {
    groupBy.mockImplementation(() => Promise.reject(new Error("db gone")));
    const health = await service.systemHealth();
    expect(health.status).toBe("ok");
    expect(health.integrations).toEqual({ total: 0, providers: {}, error: "db gone" });
  });
});
