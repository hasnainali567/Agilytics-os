import { describe, expect, it } from "@jest/globals";
import {
  buildDryRunReport,
  mapPriority,
  mapStatusToCategory,
  mapTicketType,
  parseCsv,
  parseImportFile,
  validateImport,
} from "./import.mapping";
import type { ImportFileData } from "./import.types";

describe("import status mapping", () => {
  it("maps Jira defaults to reporting categories", () => {
    expect(mapStatusToCategory("To Do", "JIRA")).toBe("TODO");
    expect(mapStatusToCategory("Backlog", "JIRA")).toBe("TODO");
    expect(mapStatusToCategory("In Progress", "JIRA")).toBe("IN_PROGRESS");
    expect(mapStatusToCategory("In Review", "JIRA")).toBe("IN_PROGRESS");
    expect(mapStatusToCategory("Done", "JIRA")).toBe("DONE");
    expect(mapStatusToCategory("Closed", "JIRA")).toBe("DONE");
  });

  it("maps ClickUp defaults", () => {
    expect(mapStatusToCategory("complete", "CLICKUP")).toBe("DONE");
    expect(mapStatusToCategory("in progress", "CLICKUP")).toBe("IN_PROGRESS");
    expect(mapStatusToCategory("to do", "CLICKUP")).toBe("TODO");
  });

  it("is case-insensitive, falls back on substrings, defaults unknown to TODO", () => {
    expect(mapStatusToCategory("DONE", "JIRA")).toBe("DONE");
    expect(mapStatusToCategory("Ready for QA", "JIRA")).toBe("IN_PROGRESS");
    expect(mapStatusToCategory("Some Custom Column", "JIRA")).toBe("TODO");
  });

  it("a custom mapping overrides the default", () => {
    expect(mapStatusToCategory("Done", "JIRA", { Done: "TODO" })).toBe("TODO");
  });

  it("maps types and priorities", () => {
    expect(mapTicketType("Epic")).toBe("EPIC");
    expect(mapTicketType("Bug")).toBe("BUG");
    expect(mapTicketType("Subtask")).toBe("TASK");
    expect(mapTicketType("weird")).toBe("TASK");
    expect(mapPriority("Highest")).toBe("URGENT");
    expect(mapPriority("Low")).toBe("LOW");
    expect(mapPriority(undefined)).toBe("MEDIUM");
  });
});

describe("CSV parsing", () => {
  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,"b, c","d""e"\n1,2,3');
    expect(rows).toEqual([
      ["a", "b, c", 'd"e'],
      ["1", "2", "3"],
    ]);
  });

  it("parses a Jira-style CSV export into projects + tickets", () => {
    const csv = [
      "Issue key,Summary,Status,Issue Type,Assignee,Priority",
      "ENG-1,Fix login,To Do,Task,aisha@example.com,High",
      "ENG-2,Ship it,Done,Story,,Medium",
    ].join("\n");
    const data = parseImportFile(csv, "CSV", "JIRA");
    expect(data.projects).toEqual([{ key: "ENG", name: "ENG" }]);
    expect(data.tickets).toHaveLength(2);
    expect(data.tickets[0]).toMatchObject({
      externalId: "ENG-1",
      externalKey: "ENG-1",
      projectKey: "ENG",
      title: "Fix login",
      status: "To Do",
      type: "Task",
      assigneeEmail: "aisha@example.com",
    });
    expect(data.users).toEqual([{ email: "aisha@example.com" }]);
  });

  it("parses a JSON export with issues + users", () => {
    const data = parseImportFile(
      JSON.stringify({
        projects: [{ key: "ENG", name: "Eng" }],
        issues: [{ id: "1001", key: "ENG-1", projectKey: "ENG", summary: "T", status: "Done" }],
        users: [{ email: "a@example.com", name: "A" }],
      }),
      "JSON",
      "JIRA",
    );
    expect(data.tickets[0]).toMatchObject({ externalId: "1001", externalKey: "ENG-1", title: "T" });
    expect(data.users).toHaveLength(1);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportFile("{nope", "JSON", "JIRA")).toThrow("not valid JSON");
  });
});

describe("dry-run validation", () => {
  const base: ImportFileData = {
    source: "JIRA",
    projects: [{ key: "ENG", name: "Eng" }],
    tickets: [
      { externalId: "1", externalKey: "ENG-1", projectKey: "ENG", title: "One", status: "To Do" },
      {
        externalId: "2",
        externalKey: "ENG-2",
        projectKey: "ENG",
        title: "Two",
        status: "Done",
        parentExternalId: "1",
      },
    ],
    users: [{ email: "a@example.com" }],
  };

  it("a clean file has no errors", () => {
    expect(validateImport(base)).toEqual([]);
  });

  it("flags missing title, unknown project, duplicate ids and bad dates", () => {
    const bad: ImportFileData = {
      ...base,
      tickets: [
        { externalId: "1", projectKey: "NOPE", title: "", status: "" },
        { externalId: "1", projectKey: "ENG", title: "x", status: "Done", dueDate: "not-a-date" },
      ],
    };
    const issues = validateImport(bad);
    expect(issues.filter((i) => i.severity === "error").length).toBeGreaterThanOrEqual(4);
    expect(issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
    expect(issues.some((i) => i.field === "dueDate")).toBe(true);
  });

  it("dry-run report shows the status mapping and counts", () => {
    const report = buildDryRunReport(base, "JSON");
    expect(report.statusMapping).toEqual({ "To Do": "TODO", Done: "DONE" });
    expect(report.wouldCreate).toEqual({ projects: 1, tickets: 2, columns: 2 });
    expect(report.errors).toEqual([]);
  });
});
