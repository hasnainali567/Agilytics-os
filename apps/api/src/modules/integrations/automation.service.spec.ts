import { describe, expect, it, jest } from "@jest/globals";
import { AutomationService } from "./automation.service";

// @octokit/rest is ESM-only and Jest (CJS ts-jest) cannot require it —
// it is pulled in transitively via GitHubProvider. Mock it so this
// suite can load the service; the github.comment action itself uses
// plain fetch, not Octokit (see automation.service.ts).
jest.mock("@octokit/rest", () => ({
  Octokit: class {
    constructor(..._args: unknown[]) {
      void _args;
    }
  },
}));

/**
 * Evaluator unit tests — the service is built directly with stub
 * dependencies (no Nest app, no DB). The Prisma stub honours the
 * tenant/trigger/isActive filter the way the real query does, so a
 * disabled rule never reaches the evaluator.
 */

type RuleRow = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  config: Record<string, unknown>;
  isActive: boolean;
};

function buildService(opts: {
  rules?: RuleRow[];
  tickets?: {
    id: string;
    key: string;
    title: string;
    projectId: string;
    assigneeId: string | null;
    priority: string;
    status: { category: string } | null;
    dailyUpdates: { date: Date }[];
  }[];
  slackPost?: jest.Mock;
  slackConfigured?: boolean;
  /** Plan of the tenant (for the automation-rule cap); default FREE. */
  plan?: string;
  /** Existing rule count for the cap check; defaults to rules.length. */
  ruleCount?: number;
}) {
  const rules = opts.rules ?? [];
  const slackPost = opts.slackPost ?? jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const notifyCalls: unknown[][] = [];
  const notifyCreate = jest.fn(async (...args: unknown[]) => {
    notifyCalls.push(args);
    return { id: "notif-1" };
  });
  const prisma = {
    organisation: {
      findUnique: jest.fn(async () => ({ plan: opts.plan ?? "FREE" })),
    },
    automationRule: {
      count: jest.fn(async () => opts.ruleCount ?? rules.length),
      findMany: jest.fn(async (args: { where?: { isActive?: boolean; trigger?: string } }) => {
        // Mirror the real query: tenant + trigger + isActive:true.
        return rules.filter(
          (r) =>
            (args.where?.trigger === undefined || r.trigger === args.where.trigger) &&
            (args.where?.isActive === undefined || r.isActive === args.where.isActive),
        );
      }),
      findFirst: jest.fn(async (args: { where: { id: string } }) =>
        rules.find((r) => r.id === args.where.id) ?? null,
      ),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "rule-new",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      })),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...rules.find((r) => r.id === args.where.id),
        ...args.data,
      })),
      delete: jest.fn(async () => ({ id: "rule-1" })),
    },
    ticket: {
      findMany: jest.fn(async () => opts.tickets ?? []),
      findFirst: jest.fn(async () => ({ boardId: "board-1", projectId: "proj-1" })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    boardColumn: {
      findFirst: jest.fn(async () => ({ id: "col-done" })),
    },
  };
  const service = new AutomationService(
    prisma as unknown as never,
    {
      isConfigured: () => opts.slackConfigured ?? true,
      defaultChannel: () => "#agilytics",
      postMessage: slackPost,
    } as never,
    {} as never,
    { createForUser: notifyCreate } as never,
    { changeStatus: jest.fn(async () => ({})) } as never,
    { audit: jest.fn(async () => undefined) } as never,
  );
  return { service, prisma, slackPost, notifyCreate, notifyCalls };
}

const CTX = {
  ticketId: "ticket-1",
  ticketKey: "ENG-123",
  ticketTitle: "Fix login redirect",
  projectId: "proj-1",
  assigneeId: "user-1",
  priority: "HIGH",
  toCategory: "DONE",
};

describe("AutomationService.evaluate", () => {
  it("runs the matching rule's slack.post action", async () => {
    const { service, slackPost } = buildService({
      rules: [
        {
          id: "r1",
          name: "Done → Slack",
          trigger: "ticket.done",
          action: "slack.post",
          config: { channel: "#agilytics" },
          isActive: true,
        },
      ],
    });
    const result = await service.evaluate("ticket.done", "demo-tenant", CTX);
    expect(result.evaluated).toBe(1);
    expect(result.outcomes[0]?.ok).toBe(true);
    expect(slackPost).toHaveBeenCalledTimes(1);
    expect(String(slackPost.mock.calls[0]?.[1] ?? "")).toContain("ENG-123");
  });

  it("skips a disabled rule (it never reaches the evaluator)", async () => {
    const { service, slackPost } = buildService({
      rules: [
        {
          id: "r1",
          name: "Off",
          trigger: "ticket.done",
          action: "slack.post",
          config: {},
          isActive: false,
        },
      ],
    });
    const result = await service.evaluate("ticket.done", "demo-tenant", CTX);
    expect(result.evaluated).toBe(0);
    expect(slackPost).not.toHaveBeenCalled();
  });

  it("skips a rule whose filter does not match, and reports it", async () => {
    const { service, slackPost } = buildService({
      rules: [
        {
          id: "r1",
          name: "Only DONE",
          trigger: "ticket.status_changed",
          action: "slack.post",
          config: { filters: { toCategory: "DONE" } },
          isActive: true,
        },
      ],
    });
    const result = await service.evaluate("ticket.status_changed", "demo-tenant", {
      ...CTX,
      toCategory: "IN_PROGRESS",
    });
    expect(result.outcomes[0]?.result).toBe("skipped: filter mismatch");
    expect(slackPost).not.toHaveBeenCalled();
  });

  it("an unknown action is reported, not thrown, and other rules still run", async () => {
    const { service, slackPost } = buildService({
      rules: [
        {
          id: "r1",
          name: "Bogus",
          trigger: "ticket.done",
          action: "carrier.pigeon",
          config: {},
          isActive: true,
        },
        {
          id: "r2",
          name: "Real",
          trigger: "ticket.done",
          action: "slack.post",
          config: {},
          isActive: true,
        },
      ],
    });
    const result = await service.evaluate("ticket.done", "demo-tenant", CTX);
    expect(result.outcomes[0]?.ok).toBe(false);
    expect(result.outcomes[0]?.result).toMatch(/Unknown automation action/);
    expect(result.outcomes[1]?.ok).toBe(true);
    expect(slackPost).toHaveBeenCalledTimes(1);
  });

  it("a failing action does not throw — evaluate resolves with ok:false", async () => {
    const failingPost = jest.fn<() => Promise<void>>().mockRejectedValue(new Error("Slack down"));
    const { service } = buildService({
      rules: [
        {
          id: "r1",
          name: "Slack",
          trigger: "ticket.done",
          action: "slack.post",
          config: {},
          isActive: true,
        },
      ],
      slackPost: failingPost,
    });
    const result = await service.evaluate("ticket.done", "demo-tenant", CTX);
    expect(result.outcomes[0]?.ok).toBe(false);
    expect(result.outcomes[0]?.result).toMatch(/Slack down/);
  });

  it("slack.post with Slack unconnected is a graceful skip", async () => {
    const { service, slackPost } = buildService({
      rules: [
        {
          id: "r1",
          name: "Slack",
          trigger: "ticket.done",
          action: "slack.post",
          config: {},
          isActive: true,
        },
      ],
      slackConfigured: false,
    });
    const result = await service.evaluate("ticket.done", "demo-tenant", CTX);
    expect(result.outcomes[0]?.result).toMatch(/Slack not connected/);
    expect(slackPost).not.toHaveBeenCalled();
  });

  it("notification.create notifies the assignee", async () => {
    const { service, notifyCreate, notifyCalls } = buildService({
      rules: [
        {
          id: "r1",
          name: "Notify",
          trigger: "ticket.overdue",
          action: "notification.create",
          config: { message: "{ticket.key} is overdue" },
          isActive: true,
        },
      ],
    });
    const result = await service.evaluate("ticket.overdue", "demo-tenant", CTX);
    expect(result.outcomes[0]?.ok).toBe(true);
    expect(notifyCreate).toHaveBeenCalledTimes(1);
    expect(notifyCalls[0]?.[1]).toBe("user-1");
    expect(notifyCalls[0]?.[2]).toMatchObject({ type: "AUTOMATION" });
    expect(
      String((notifyCalls[0]?.[2] as { title?: string } | undefined)?.title ?? ""),
    ).toContain("ENG-123 is overdue");
  });

  it("ticket.update moves status through changeStatus and sets priority", async () => {
    const { service, prisma } = buildService({
      rules: [
        {
          id: "r1",
          name: "Auto-close",
          trigger: "ticket.created",
          action: "ticket.update",
          config: { statusCategory: "DONE", priority: "LOW" },
          isActive: true,
        },
      ],
    });
    const result = await service.evaluate("ticket.created", "demo-tenant", CTX);
    expect(result.outcomes[0]?.ok).toBe(true);
    expect(result.outcomes[0]?.result).toMatch(/status → DONE/);
    expect(prisma.ticket.updateMany).toHaveBeenCalled();
  });

  it("webhook.post without a url is a graceful skip (no fetch)", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    const { service } = buildService({
      rules: [
        {
          id: "r1",
          name: "Hook",
          trigger: "ticket.done",
          action: "webhook.post",
          config: {},
          isActive: true,
        },
      ],
    });
    const result = await service.evaluate("ticket.done", "demo-tenant", CTX);
    expect(result.outcomes[0]?.result).toMatch(/needs config\.url/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("AutomationService.create — API validation", () => {
  it("rejects an unknown trigger with a 400", async () => {
    const { service } = buildService({});
    await expect(
      service.create("demo-tenant", { name: "x", trigger: "ticket.exploded", action: "slack.post" }),
    ).rejects.toThrow(/Invalid automation rule/);
  });

  it("rejects an unknown action with a 400", async () => {
    const { service } = buildService({});
    await expect(
      service.create("demo-tenant", { name: "x", trigger: "ticket.done", action: "carrier.pigeon" }),
    ).rejects.toThrow(/Invalid automation rule/);
  });

  it("rejects webhook.post without a url", async () => {
    const { service } = buildService({});
    await expect(
      service.create("demo-tenant", {
        name: "x",
        trigger: "ticket.done",
        action: "webhook.post",
        config: {},
      }),
    ).rejects.toThrow(/config\.url/);
  });

  it("creates a valid rule", async () => {
    const { service } = buildService({});
    const rule = await service.create("demo-tenant", {
      name: "Done → Slack",
      trigger: "ticket.done",
      action: "slack.post",
      config: { channel: "#agilytics" },
    });
    expect(rule.id).toBe("rule-new");
  });

  it("refuses a 4th rule on the FREE plan (cap 3) and creates none", async () => {
    const { service, prisma } = buildService({ plan: "FREE", ruleCount: 3 });
    await expect(
      service.create("demo-tenant", {
        name: "Fourth rule",
        trigger: "ticket.done",
        action: "slack.post",
        config: { channel: "#agilytics" },
      }),
    ).rejects.toThrow(/allows 3 automation rules/);
    expect(prisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("allows the 4th rule on STARTER (cap 10)", async () => {
    const { service } = buildService({ plan: "STARTER", ruleCount: 3 });
    const rule = await service.create("demo-tenant", {
      name: "Fourth rule",
      trigger: "ticket.done",
      action: "slack.post",
      config: { channel: "#agilytics" },
    });
    expect(rule.id).toBe("rule-new");
  });
});

describe("AutomationService.runSweep", () => {
  it("evaluates ticket.overdue only for stale, non-done tickets", async () => {
    const now = Date.now();
    const { service, slackPost } = buildService({
      rules: [
        {
          id: "r1",
          name: "Stale → Slack",
          trigger: "ticket.overdue",
          action: "slack.post",
          config: {},
          isActive: true,
        },
      ],
      tickets: [
        {
          id: "t-stale",
          key: "ENG-1",
          title: "Stale",
          projectId: "proj-1",
          assigneeId: "user-1",
          priority: "HIGH",
          status: { category: "IN_PROGRESS" },
          dailyUpdates: [{ date: new Date(now - 5 * 24 * 60 * 60 * 1000) }],
        },
        {
          id: "t-fresh",
          key: "ENG-2",
          title: "Fresh",
          projectId: "proj-1",
          assigneeId: "user-1",
          priority: "LOW",
          status: { category: "TODO" },
          dailyUpdates: [{ date: new Date(now - 1 * 24 * 60 * 60 * 1000) }],
        },
        {
          id: "t-done",
          key: "ENG-3",
          title: "Done but old",
          projectId: "proj-1",
          assigneeId: "user-1",
          priority: "LOW",
          status: { category: "DONE" },
          dailyUpdates: [{ date: new Date(now - 9 * 24 * 60 * 60 * 1000) }],
        },
        {
          id: "t-never",
          key: "ENG-4",
          title: "Never updated",
          projectId: "proj-1",
          assigneeId: null,
          priority: "MEDIUM",
          status: null,
          dailyUpdates: [],
        },
      ],
    });
    const result = await service.runSweep("demo-tenant");
    expect(result.staleTickets).toBe(2);
    expect(slackPost).toHaveBeenCalledTimes(2);
  });
});
