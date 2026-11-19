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

  /**
   * Platform health — additive shape: the old `status` / `service` /
   * `time` fields are unchanged; `database` and `integrations` are new.
   * Never throws: a failing check degrades `status` to "degraded"
   * instead of 500ing the endpoint. Integration health is counts per
   * provider only — no tokens, secrets, or credentials ever leave here.
   */
  async systemHealth() {
    const started = Date.now();
    let database: { ok: boolean; latencyMs?: number; error?: string };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      database = { ok: false, error: (err as Error).message.slice(0, 200) };
    }

    let integrations: { total: number; providers: Record<string, number>; error?: string };
    try {
      const rows = await this.prisma.integration.groupBy({
        by: ["provider"],
        where: { isActive: true },
        _count: { _all: true },
      });
      const providers: Record<string, number> = {};
      for (const row of rows) providers[row.provider] = row._count._all;
      integrations = {
        total: rows.reduce((n, r) => n + r._count._all, 0),
        providers,
      };
    } catch (err) {
      integrations = { total: 0, providers: {}, error: (err as Error).message.slice(0, 200) };
    }

    return {
      status: database.ok ? "ok" : "degraded",
      service: "agilytics-os-api",
      time: new Date().toISOString(),
      database,
      integrations,
    };
  }
}
