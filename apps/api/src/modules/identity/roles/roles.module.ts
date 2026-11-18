import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PrismaService } from "../../../prisma/prisma.service";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

/**
 * Roles module (decision 21). Owns Role / RolePermission / the
 * permission catalog, the PermissionsGuard, and `seedSystemRoles`.
 *
 * WIRING (do not edit app.module.ts from this slice — parent to apply):
 *   import { RolesModule } from "./modules/identity/roles/roles.module";
 *   // in AppModule imports: [ ..., RolesModule, ... ]
 *
 * Other modules can use the guard by importing RolesModule and adding
 * `@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@RequirePermissions(...)`
 * on their controllers. To enforce everywhere by default, register the
 * guard globally instead:
 *   { provide: APP_GUARD, useClass: PermissionsGuard }
 * (routes without @RequirePermissions metadata still pass — the guard
 * only denies when a requirement is declared and unmet).
 *
 * SEEDING: there is no workspace-creation endpoint in the API yet, so
 * nothing calls `seedSystemRoles` today. When the creation path lands,
 * call `await seedSystemRoles(prisma, organisation.id)` inside its
 * transaction, and call it in `apps/api/prisma/seed.ts` for the demo
 * org. Until then every workspace needs its five system roles seeded
 * by that call — the guard falls back to the hardcoded §2.1 defaults
 * for legacy memberships, but custom roles cannot exist without rows.
 */
@Module({
  controllers: [RolesController],
  providers: [RolesService, PrismaService, PermissionsGuard],
  exports: [RolesService, PermissionsGuard],
})
export class RolesModule {}
