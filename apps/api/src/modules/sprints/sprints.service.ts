import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { emitAutomationEvent } from "../../common/automation-events";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Sprint lifecycle transitions. List/create stay on the controller;
 * only the state transitions live here, because they carry the audit
 * + automation side effects (same split as TicketsService.changeStatus).
 */
@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSprint(tenantId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({ where: { id: sprintId, tenantId } });
    if (!sprint) throw new NotFoundException("Sprint not found in this tenant");
    return sprint;
  }

  /** PLANNED → ACTIVE. No automation trigger exists for starting a sprint. */
  async start(tenantId: string, sprintId: string, userId: string) {
    const sprint = await this.assertSprint(tenantId, sprintId);
    if (sprint.status !== "PLANNED") {
      throw new BadRequestException(
        `Only a PLANNED sprint can be started (current status: ${sprint.status})`,
      );
    }
    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: { status: "ACTIVE" },
    });
    await this.audit(tenantId, userId, "sprint.started", "Sprint", sprintId, {
      projectId: sprint.projectId,
      name: sprint.name,
    });
    return updated;
  }

  /** ACTIVE (or PLANNED) → COMPLETED. Fires the sprint.completed automation event. */
  async complete(tenantId: string, sprintId: string, userId: string) {
    const sprint = await this.assertSprint(tenantId, sprintId);
    if (sprint.status === "COMPLETED") {
      throw new BadRequestException("Sprint is already completed");
    }
    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: { status: "COMPLETED" },
    });
    await this.audit(tenantId, userId, "sprint.completed", "Sprint", sprintId, {
      projectId: sprint.projectId,
      name: sprint.name,
    });
    // [worker-b: automations] one-line hook — automation rules (sprint.completed). Never throws.
    emitAutomationEvent("sprint.completed", tenantId, {
      sprintId,
      sprintName: sprint.name,
      projectId: sprint.projectId,
      userId,
    });
    return updated;
  }

  /** Same audit() shape as RolesService — one AuditLog row per mutation. */
  private audit(
    tenantId: string,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity,
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
