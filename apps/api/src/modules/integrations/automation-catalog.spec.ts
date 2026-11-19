import { describe, expect, it } from "@jest/globals";
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  createAutomationRuleSchema,
} from "@agilytics/shared";
import {
  defaultMessage,
  matchesFilters,
  renderTemplate,
  ruleFilters,
} from "./automation-catalog";

describe("automation catalog — pure helpers", () => {
  it("trigger/action enums cover the Phase 2 catalog", () => {
    expect([...AUTOMATION_TRIGGERS]).toEqual([
      "ticket.created",
      "ticket.status_changed",
      "ticket.overdue",
      "ticket.done",
      "sprint.completed",
      "daily_update.created",
      "comment.created",
    ]);
    expect([...AUTOMATION_ACTIONS]).toEqual([
      "slack.post",
      "github.comment",
      "notification.create",
      "ticket.update",
      "webhook.post",
    ]);
  });

  it("a rule with no filters fires on any event of its trigger", () => {
    expect(matchesFilters({}, { ticketKey: "ENG-1" })).toBe(true);
    expect(matchesFilters(null, {})).toBe(true);
    expect(matchesFilters({ channel: "#general" }, {})).toBe(true);
  });

  it("toCategory filter fires only on the matching move", () => {
    const config = { filters: { toCategory: "DONE" } };
    expect(matchesFilters(config, { toCategory: "DONE" })).toBe(true);
    expect(matchesFilters(config, { toCategory: "IN_PROGRESS" })).toBe(false);
    expect(matchesFilters(config, {})).toBe(false);
  });

  it("project / priority / assignee filters all have to match", () => {
    const config = { filters: { projectId: "p1", priority: "HIGH" } };
    expect(matchesFilters(config, { projectId: "p1", priority: "HIGH" })).toBe(true);
    expect(matchesFilters(config, { projectId: "p1", priority: "LOW" })).toBe(false);
    expect(matchesFilters(config, { projectId: "p2", priority: "HIGH" })).toBe(false);
  });

  it("ruleFilters ignores unknown filter keys and non-object filters", () => {
    expect(ruleFilters({ filters: { toCategory: "DONE", whatever: "x" } })).toEqual({
      toCategory: "DONE",
      projectId: undefined,
      priority: undefined,
      assigneeId: undefined,
    });
    expect(ruleFilters({ filters: "DONE" })).toEqual({});
  });

  it("renderTemplate replaces known placeholders and leaves unknown ones", () => {
    const out = renderTemplate(
      "Ticket {ticket.key}: {ticket.title} — {trigger} {unknown}",
      "ticket.done",
      { ticketKey: "ENG-123", ticketTitle: "Fix login" },
    );
    expect(out).toBe("Ticket ENG-123: Fix login — ticket.done {unknown}");
  });

  it("defaultMessage names the ticket and the trigger", () => {
    expect(defaultMessage("ticket.overdue", { ticketKey: "ENG-9", ticketTitle: "Slow query" })).toContain(
      "ENG-9",
    );
    expect(defaultMessage("ticket.overdue", { ticketKey: "ENG-9", ticketTitle: "Slow query" })).toContain(
      "overdue",
    );
    expect(defaultMessage("sprint.completed", { sprintName: "Sprint 2" })).toContain("Sprint 2");
  });

  it("createAutomationRuleSchema rejects unknown trigger / action", () => {
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

  it("createAutomationRuleSchema requires an http(s) url for webhook.post", () => {
    expect(
      createAutomationRuleSchema.safeParse({
        name: "x",
        trigger: "ticket.done",
        action: "webhook.post",
        config: {},
      }).success,
    ).toBe(false);
    expect(
      createAutomationRuleSchema.safeParse({
        name: "x",
        trigger: "ticket.done",
        action: "webhook.post",
        config: { url: "https://hooks.example.com/agilytics" },
      }).success,
    ).toBe(true);
  });
});
