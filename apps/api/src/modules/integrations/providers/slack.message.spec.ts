import { describe, expect, it } from "@jest/globals";
import {
  formatDailyDigestMessage,
  formatTicketAlertMessage,
  formatTicketClosedMessage,
  formatTicketLinkedMessage,
  formatTicketStartedMessage,
} from "./slack.message";

const ticket = {
  key: "ENG-123",
  title: "Fix login redirect",
  url: "https://app.example/t/ENG-123",
};
const commit = {
  sha: "abc1234def5678",
  message: "Fixes ENG-123: redirect after login",
  authorName: "Aisha",
};

describe("Slack message formatting", () => {
  it("closed message names the ticket, short sha, author and first line", () => {
    const msg = formatTicketClosedMessage(ticket, commit);
    expect(msg).toContain("ENG-123");
    expect(msg).toContain("Fix login redirect");
    expect(msg).toContain("abc1234");
    expect(msg).not.toContain("abc1234def5678");
    expect(msg).toContain("Aisha");
    expect(msg).toContain("<https://app.example/t/ENG-123|");
  });

  it("closed message works without url or author", () => {
    const msg = formatTicketClosedMessage(
      { key: "ENG-9", title: "T" },
      { sha: "deadbee", message: "x" },
    );
    expect(msg).toContain("ENG-9");
    expect(msg).not.toContain("<");
  });

  it("started / linked messages keep key + sha and differ in intent", () => {
    expect(formatTicketStartedMessage(ticket, commit)).toContain("Work started");
    expect(formatTicketLinkedMessage(ticket, commit)).toContain("mentions");
  });

  it("alert message varies by kind", () => {
    expect(formatTicketAlertMessage("overdue", ticket)).toContain("is overdue");
    expect(formatTicketAlertMessage("at-risk", ticket, "no update in 3 days")).toContain(
      "no update in 3 days",
    );
    expect(formatTicketAlertMessage("created", ticket)).toContain("created");
  });

  it("daily digest lists silent members and blockers", () => {
    const msg = formatDailyDigestMessage({
      date: "2026-11-18",
      updatedCount: 2,
      silentNames: ["Zaid"],
      openBlockers: [{ ticketKey: "ENG-5", memberName: "Aisha", blockers: "Waiting on API" }],
    });
    expect(msg).toContain("2026-11-18");
    expect(msg).toContain("Silent today: Zaid");
    expect(msg).toContain("ENG-5");
    expect(msg).toContain("Waiting on API");
  });

  it("daily digest omits empty sections", () => {
    const msg = formatDailyDigestMessage({
      date: "2026-11-18",
      updatedCount: 3,
      silentNames: [],
      openBlockers: [],
    });
    expect(msg).not.toContain("Silent today");
    expect(msg).not.toContain("Open blockers");
  });
});
