/**
 * Slack message formatting — pure functions, no SDK calls, so they are
 * unit-testable without a Slack token. Formatting only; sending lives in
 * SlackProvider.postMessage / postTicketClosed.
 *
 * Style: Slack mrkdwn — *bold*, <url|label> links, one idea per line.
 * No customer data beyond the ticket title/key the rule already handled.
 */

export interface SlackTicketRef {
  key: string;
  title: string;
  /** Deep link back to the ticket in the web app, when known. */
  url?: string;
}

export interface SlackCommitRef {
  sha: string;
  message: string;
  authorName?: string;
}

function ticketLabel(ticket: SlackTicketRef): string {
  const label = `*${ticket.key}* — ${ticket.title}`;
  return ticket.url ? `<${ticket.url}|${label}>` : label;
}

/** "commit closes ticket" automation: commit → ticket DONE → Slack. */
export function formatTicketClosedMessage(ticket: SlackTicketRef, commit: SlackCommitRef): string {
  const shortSha = commit.sha.slice(0, 7);
  const author = commit.authorName ? ` by ${commit.authorName}` : "";
  return (
    `:white_check_mark: ${ticketLabel(ticket)} was closed by commit ` +
    `\`${shortSha}\`${author}\n>${commit.message.split("\n")[0]}`
  );
}

/** Ticket moved to in-progress by a commit (no close keyword). */
export function formatTicketStartedMessage(ticket: SlackTicketRef, commit: SlackCommitRef): string {
  const shortSha = commit.sha.slice(0, 7);
  return (
    `:arrow_forward: Work started on ${ticketLabel(ticket)} ` +
    `(commit \`${shortSha}\`)\n>${commit.message.split("\n")[0]}`
  );
}

/** A commit/PR mentioned a ticket without moving it — link only. */
export function formatTicketLinkedMessage(ticket: SlackTicketRef, commit: SlackCommitRef): string {
  const shortSha = commit.sha.slice(0, 7);
  return (
    `:link: Commit \`${shortSha}\` mentions ${ticketLabel(ticket)}\n` +
    `>${commit.message.split("\n")[0]}`
  );
}

/** Ticket created / overdue / at-risk channel alert (trigger → action). */
export function formatTicketAlertMessage(
  kind: "created" | "overdue" | "at-risk",
  ticket: SlackTicketRef,
  detail?: string,
): string {
  const icon = kind === "created" ? ":new:" : kind === "overdue" ? ":alarm_clock:" : ":warning:";
  const verb = kind === "created" ? "created" : kind === "overdue" ? "is overdue" : "is at risk";
  return `${icon} ${ticketLabel(ticket)} ${verb}${detail ? `\n>${detail}` : ""}`;
}

/** Daily digest: who updated, who is silent, open blockers. */
export function formatDailyDigestMessage(input: {
  date: string;
  updatedCount: number;
  silentNames: string[];
  openBlockers: { ticketKey: string; memberName: string; blockers: string | null }[];
}): string {
  const lines = [
    `:clipboard: *Daily digest — ${input.date}*`,
    `${input.updatedCount} member(s) posted a daily update.`,
  ];
  if (input.silentNames.length > 0) {
    lines.push(`Silent today: ${input.silentNames.join(", ")}`);
  }
  if (input.openBlockers.length > 0) {
    lines.push("*Open blockers:*");
    for (const b of input.openBlockers) {
      lines.push(`• ${b.ticketKey} (${b.memberName}): ${b.blockers ?? "no detail"}`);
    }
  }
  return lines.join("\n");
}
