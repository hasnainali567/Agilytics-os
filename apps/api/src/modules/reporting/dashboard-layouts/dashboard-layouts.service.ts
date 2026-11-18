import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { DashboardLayoutJson, RoleTemplate } from "./dashboard-layout.schema";
import { dashboardLayoutSchema } from "./dashboard-layout.schema";
import { defaultLayoutFor, templateForMembershipRole } from "./templates";

export interface SavedLayout {
  id: string | null;
  name: string;
  layout: DashboardLayoutJson;
  template: string | null;
  isDefault: boolean;
  /** False when no row is stored yet — the layout is a generated default. */
  persisted: boolean;
}

/**
 * Per-user dashboard layouts (decision 20). Every query is scoped by
 * tenantId AND userId — a layout from another tenant or user is never
 * returned, updated or deleted. The unique key is (userId, tenantId,
 * name); the default layout is named "default".
 */
@Injectable()
export class DashboardLayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLayout(
    tenantId: string,
    userId: string,
    opts: { name?: string; template?: RoleTemplate } = {},
  ): Promise<SavedLayout> {
    const name = opts.name ?? "default";
    const stored = await this.prisma.dashboardLayout.findUnique({
      where: { userId_tenantId_name: { userId, tenantId, name } },
    });
    if (stored) {
      return {
        id: stored.id,
        name: stored.name,
        layout: dashboardLayoutSchema.parse(stored.layout),
        template: stored.template,
        isDefault: stored.isDefault,
        persisted: true,
      };
    }
    const template = opts.template ?? (await this.seedTemplateFor(tenantId, userId));
    return {
      id: null,
      name,
      layout: defaultLayoutFor(template),
      template,
      isDefault: name === "default",
      persisted: false,
    };
  }

  async saveLayout(
    tenantId: string,
    userId: string,
    input: { name?: string; layout: unknown; template?: RoleTemplate },
  ): Promise<SavedLayout> {
    const layout = dashboardLayoutSchema.parse(input.layout);
    const name = input.name ?? "default";
    const stored = await this.prisma.dashboardLayout.upsert({
      where: { userId_tenantId_name: { userId, tenantId, name } },
      create: {
        tenantId,
        userId,
        name,
        layout,
        isDefault: name === "default",
        template: input.template ?? null,
      },
      update: {
        layout,
        template: input.template ?? undefined,
      },
    });
    return {
      id: stored.id,
      name: stored.name,
      layout: dashboardLayoutSchema.parse(stored.layout),
      template: stored.template,
      isDefault: stored.isDefault,
      persisted: true,
    };
  }

  /**
   * Reset = delete the stored layout; the next GET regenerates the
   * role-template default. Returns that fresh default (not persisted).
   * Resetting a user who never saved anything is a no-op success —
   * they already have the default.
   */
  async resetLayout(
    tenantId: string,
    userId: string,
    opts: { name?: string; template?: RoleTemplate } = {},
  ): Promise<SavedLayout> {
    const name = opts.name ?? "default";
    const stored = await this.prisma.dashboardLayout.findUnique({
      where: { userId_tenantId_name: { userId, tenantId, name } },
    });
    if (stored) {
      await this.prisma.dashboardLayout.delete({ where: { id: stored.id } });
    }
    const template =
      opts.template ?? stored?.template ?? (await this.seedTemplateFor(tenantId, userId));
    return {
      id: null,
      name,
      layout: defaultLayoutFor(template as RoleTemplate),
      template: template as string,
      isDefault: name === "default",
      persisted: false,
    };
  }

  /** Seed template from the caller's membership role; developer if none. */
  private async seedTemplateFor(tenantId: string, userId: string): Promise<RoleTemplate> {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { role: true },
    });
    return templateForMembershipRole(membership?.role ?? null);
  }
}
