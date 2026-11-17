import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listOrganisations() {
    return this.prisma.organisation.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { memberships: true, projects: true } } },
    });
  }

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { memberships: { include: { organisation: true } } },
    });
  }

  listAuditLogs(tenantId?: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  systemHealth() {
    return {
      status: "ok",
      service: "agilytics-os-api",
      time: new Date().toISOString(),
      // TODO: add DB ping, queue depth, and integration health checks.
    };
  }
}
