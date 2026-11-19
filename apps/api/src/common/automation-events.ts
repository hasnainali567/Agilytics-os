import { EventEmitter } from "node:events";
import type { AutomationTrigger } from "@agilytics/shared";

/**
 * Automation event bus — the one-line hook between event sites and the
 * rule evaluator, without a Nest DI cycle.
 *
 * Why a plain EventEmitter and not injection: AutomationService needs
 * TicketsService (the `ticket.update` action moves tickets through
 * TicketsService.changeStatus, the one place status history is written),
 * and TicketsService is where `ticket.created` / `ticket.status_changed`
 * happen — injecting the service both ways is a circular module
 * dependency (IntegrationsModule ↔ TicketsModule). A module-neutral
 * bus keeps both sides decoupled: event sites only `emitAutomationEvent`,
 * AutomationService subscribes in `onModuleInit` and evaluates.
 *
 * Fire-and-forget by design: `emitAutomationEvent` never throws (the
 * emit is wrapped) and listeners run async — a failed rule can never
 * break the request that raised the event. `AutomationService.evaluate`
 * itself catches per-rule/per-action errors as well.
 */
export interface AutomationEventContext {
  ticketId?: string;
  ticketKey?: string;
  ticketTitle?: string;
  projectId?: string;
  assigneeId?: string;
  /** Actor who caused the event (daily-update author, comment author). */
  userId?: string;
  priority?: string;
  /** Column category the ticket moved INTO (status change / done). */
  toCategory?: string;
  sprintId?: string;
  sprintName?: string;
  /** Free text for templates (daily-update text, comment body). */
  text?: string;
}

export interface AutomationEvent {
  trigger: AutomationTrigger;
  tenantId: string;
  context: AutomationEventContext;
}

export const automationEvents = new EventEmitter();
automationEvents.setMaxListeners(20);

export function emitAutomationEvent(
  trigger: AutomationTrigger,
  tenantId: string,
  context: AutomationEventContext = {},
): void {
  try {
    automationEvents.emit("automation", { trigger, tenantId, context } satisfies AutomationEvent);
  } catch {
    // The bus must never break the caller — the evaluator logs its own failures.
  }
}
