import { describe, expect, it } from "@jest/globals";
import { createDailyUpdateSchema, updateTicketStatusSchema } from "@agilytics/shared";

// Statuses are BoardColumn ids in v2 — there is no fixed status enum.
// A status change moves a ticket to a column; the column id must be a uuid.
describe("tickets API contract", () => {
  it("accepts a valid status change to a column id", () => {
    const columnId = "00000000-0000-4000-8000-000000000001";
    expect(updateTicketStatusSchema.parse({ statusId: columnId }).statusId).toBe(columnId);
  });

  it("rejects a status change to a non-uuid", () => {
    expect(() => updateTicketStatusSchema.parse({ statusId: "DONE" })).toThrow();
    expect(() => updateTicketStatusSchema.parse({ status: "DONE" })).toThrow();
  });
});

describe("daily updates API contract", () => {
  it("accepts a valid daily update", () => {
    const parsed = createDailyUpdateSchema.parse({
      doneToday: "Shipped the dashboard shell",
      next: "Wire the reports page",
      progressPercent: 60,
    });
    expect(parsed.doneToday).toBe("Shipped the dashboard shell");
    expect(parsed.health).toBe("ON_TRACK");
    expect(parsed.hasBlocker).toBe(false);
  });

  it("rejects a progress percent over 100", () => {
    expect(() => createDailyUpdateSchema.parse({ doneToday: "x", progressPercent: 101 })).toThrow();
  });
});
