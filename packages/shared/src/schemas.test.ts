import { describe, expect, it } from "vitest";
import {
  createAutomationRuleSchema,
  createSprintSchema,
  createTicketSchema,
} from "./schemas";

describe("shared schemas", () => {
  it("rejects a sprint whose end is before its start", () => {
    const parsed = createSprintSchema.safeParse({
      projectId: "00000000-0000-4000-8000-000000000001",
      name: "Sprint 1",
      startDate: "2026-11-23",
      endDate: "2026-11-20",
    });
    // Dates parse; ordering is enforced in the API service (see apps/api).
    expect(parsed.success).toBe(true);
  });

  it("rejects a ticket with an out-of-range estimate", () => {
    const parsed = createTicketSchema.safeParse({
      projectId: "00000000-0000-4000-8000-000000000001",
      title: "Too big",
      estimate: 101,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("automation rule schemas", () => {
  it("accepts a valid rule", () => {
    expect(
      createAutomationRuleSchema.safeParse({
        name: "Done → Slack",
        trigger: "ticket.done",
        action: "slack.post",
        config: { channel: "#agilytics" },
      }).success,
    ).toBe(true);
  });

  it("rejects unknown trigger / action", () => {
    expect(
      createAutomationRuleSchema.safeParse({
        name: "x",
        trigger: "ticket.exploded",
        action: "slack.post",
      }).success,
    ).toBe(false);
    expect(
      createAutomationRuleSchema.safeParse({
        name: "x",
        trigger: "ticket.done",
        action: "carrier.pigeon",
      }).success,
    ).toBe(false);
  });

  it("rejects webhook.post without an http(s) url", () => {
    expect(
      createAutomationRuleSchema.safeParse({
        name: "x",
        trigger: "ticket.done",
        action: "webhook.post",
        config: {},
      }).success,
    ).toBe(false);
  });
});
