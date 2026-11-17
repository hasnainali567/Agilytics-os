import type {
  Board,
  BoardColumn,
  DailyUpdate,
  MemberRole,
  Organisation,
  Project,
  Sprint,
  Ticket,
  TicketPriority,
} from "./schemas";

export type {
  Board,
  BoardColumn,
  DailyUpdate,
  MemberRole,
  Organisation,
  Project,
  Sprint,
  Ticket,
  TicketPriority,
};

export interface Member {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  /** Tickets currently assigned, from the workload service. */
  activeTickets: number;
  /** Story points completed in the current sprint. */
  completedPoints: number;
  status: "ACTIVE" | "OVERLOADED" | "AT_RISK" | "INACTIVE";
}

export interface DashboardKpis {
  activeProjects: number;
  activeProjectsDelta: number;
  ticketsDoneThisSprint: number;
  ticketsDoneDelta: number;
  velocityPoints: number;
  velocityDelta: number;
  atRiskMembers: number;
  overdueTickets: number;
}

export interface VelocityPoint {
  week: string;
  completed: number;
  planned: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  velocity: VelocityPoint[];
  members: Member[];
  /** Today feed — derived from daily updates + status history, never comments. */
  today: TodayFeed;
}

export interface TodayFeed {
  date: string;
  updatedMembers: number;
  totalMembers: number;
  /** Members who have posted a daily update today (names, max 10). */
  updatedNames: string[];
  /** Members with no update today (names, max 10). */
  silentNames: string[];
  openBlockers: number;
  staleTickets: { id: string; title: string; daysStale: number }[];
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
