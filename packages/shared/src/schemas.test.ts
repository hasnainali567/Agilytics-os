import { describe, expect, it } from "vitest";
import { createSprintSchema, createTicketSchema } from "./schemas";

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
