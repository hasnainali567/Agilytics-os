/**
 * Commit → ticket rule engine — pure functions, no DB, no SDK calls.
 *
 * Rules (Phase 1, GitHub-style close keywords):
 * - A ticket key is `PROJECT-123` (upper-case project key + number).
 * - `Fixes ENG-123` / `Closes ENG-123` / `Resolves ENG-123` (keyword
 *   immediately before the key, any case) → CLOSE the ticket.
 * - `Starts ENG-123` / `WIP ENG-123` / `in progress ENG-123` → START it
 *   (move to the IN_PROGRESS column).
 * - A bare key with no keyword (`Refs ENG-123`, `ENG-123: …`) → LINK only:
 *   record the mention, do not move the ticket.
 * - Branch names carry the same keys: `feature/ENG-123-login` → ENG-123.
 * - `Reopens ENG-123` → REOPEN (move back to a TODO column).
 *
 * The service that applies these rules lives in commit-rule.service.ts;
 * this file only decides *what* a message means.
 */

export type CommitAction = "CLOSE" | "START" | "LINK" | "REOPEN";

export interface ParsedCommit {
  /** Ticket keys in order of first appearance, de-duplicated. */
  ticketKeys: string[];
  /** The strongest action implied by the message (CLOSE > REOPEN > START > LINK). */
  action: CommitAction;
  /** Per-key action — a message can close one ticket and only link another. */
  perKey: { key: string; action: CommitAction }[];
}

/** `ENG-123`, `ABC-1` — project key 2–10 upper-case alphanumerics. */
export const TICKET_KEY_RE = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/g;

const CLOSE_KEYWORDS = [
  "fix",
  "fixes",
  "fixed",
  "close",
  "closes",
  "closed",
  "resolve",
  "resolves",
  "resolved",
];
const START_KEYWORDS = ["start", "starts", "started", "wip"];
const REOPEN_KEYWORDS = ["reopen", "reopens", "reopened"];

/** All ticket keys in a message, de-duplicated, in order of appearance. */
export function parseTicketKeys(message: string): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const m of message.matchAll(TICKET_KEY_RE)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      keys.push(m[1]);
    }
  }
  return keys;
}

/** Ticket key embedded in a branch name, e.g. `feature/ENG-123-login`. */
export function extractBranchTicketKey(branch: string): string | null {
  // NB: TICKET_KEY_RE is global, so String.match on it returns full
  // matches with no capture groups — use a non-global copy here.
  const m = branch.match(/([A-Z][A-Z0-9]{1,9}-\d+)/);
  return m ? m[1] : null;
}

function keywordBefore(message: string, keyIndex: number, keywords: string[]): boolean {
  // Keyword must sit just before the key (GitHub-style): allow the
  // keyword, optional suffix, whitespace and an optional `#`.
  const before = message.slice(Math.max(0, keyIndex - 16), keyIndex);
  const pattern = new RegExp(`\\b(${keywords.join("|")})\\s*#?\\s*$`, "i");
  return pattern.test(before);
}

/** "in progress ENG-123" — the phrase form has no single keyword. */
function inProgressBefore(message: string, keyIndex: number): boolean {
  const before = message.slice(Math.max(0, keyIndex - 16), keyIndex);
  return /\bin\s+progress\s*#?\s*$/i.test(before);
}

export function resolveCommitAction(message: string): ParsedCommit {
  const perKey: { key: string; action: CommitAction }[] = [];
  const seen = new Set<string>();
  for (const m of message.matchAll(TICKET_KEY_RE)) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = m.index ?? 0;
    let action: CommitAction = "LINK";
    if (keywordBefore(message, idx, CLOSE_KEYWORDS)) action = "CLOSE";
    else if (keywordBefore(message, idx, REOPEN_KEYWORDS)) action = "REOPEN";
    else if (keywordBefore(message, idx, START_KEYWORDS) || inProgressBefore(message, idx))
      action = "START";
    perKey.push({ key, action });
  }
  const rank: Record<CommitAction, number> = { CLOSE: 3, REOPEN: 2, START: 1, LINK: 0 };
  const action = perKey.reduce<CommitAction>(
    (best, p) => (rank[p.action] > rank[best] ? p.action : best),
    "LINK",
  );
  return { ticketKeys: perKey.map((p) => p.key), action, perKey };
}
