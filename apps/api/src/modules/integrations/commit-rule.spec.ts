import { describe, expect, it } from "@jest/globals";
import { extractBranchTicketKey, parseTicketKeys, resolveCommitAction } from "./commit-rule";

describe("commit → ticket parsing", () => {
  it("finds keys and de-duplicates in order", () => {
    expect(parseTicketKeys("ENG-123 and ENG-123 then ABC-9")).toEqual(["ENG-123", "ABC-9"]);
    expect(parseTicketKeys("no keys here")).toEqual([]);
    expect(parseTicketKeys("lowercase eng-123 is not a key")).toEqual([]);
  });

  it("close keywords immediately before the key → CLOSE", () => {
    for (const msg of [
      "Fixes ENG-123: redirect",
      "closes ENG-123",
      "Resolved ENG-123",
      "fix ENG-123",
      "Fixed #ENG-123",
    ]) {
      const r = resolveCommitAction(msg);
      expect(r.action).toBe("CLOSE");
      expect(r.ticketKeys).toEqual(["ENG-123"]);
    }
  });

  it("a close keyword far from the key does not close it", () => {
    const r = resolveCommitAction("Fixes the build. Also touches ENG-123 for logging.");
    expect(r.perKey[0]?.action).toBe("LINK");
  });

  it("bare key → LINK only, never moves the ticket", () => {
    const r = resolveCommitAction("ENG-123: add logging");
    expect(r.action).toBe("LINK");
    expect(resolveCommitAction("Refs ENG-123").action).toBe("LINK");
  });

  it("start / wip / in-progress keywords → START", () => {
    expect(resolveCommitAction("Starts ENG-123").action).toBe("START");
    expect(resolveCommitAction("WIP ENG-123").action).toBe("START");
    expect(resolveCommitAction("in progress ENG-123").action).toBe("START");
  });

  it("reopen keyword → REOPEN", () => {
    expect(resolveCommitAction("Reopens ENG-123, regression").action).toBe("REOPEN");
  });

  it("per-key actions: one message can close one ticket and link another", () => {
    const r = resolveCommitAction("Fixes ENG-123, also ENG-456");
    expect(r.perKey).toEqual([
      { key: "ENG-123", action: "CLOSE" },
      { key: "ENG-456", action: "LINK" },
    ]);
    expect(r.action).toBe("CLOSE");
  });

  it("extracts the key from a branch name", () => {
    expect(extractBranchTicketKey("feature/ENG-123-login")).toBe("ENG-123");
    expect(extractBranchTicketKey("fix/abc-9-x")).toBeNull();
    expect(extractBranchTicketKey("main")).toBeNull();
  });
});
