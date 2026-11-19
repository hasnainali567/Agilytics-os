import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { PrismaService } from "../../../prisma/prisma.service";
import { InvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";

/**
 * Invites module — member invites (invite first, account on accept).
 * Owns the Invite model + POST /members/invite, GET /members/invites,
 * POST /members/invites/:token/accept, DELETE /members/invites/:id.
 *
 * Wiring: import { InvitesModule } from "./modules/identity/invites/invites.module"
 * in AppModule imports.
 */
@Module({
  controllers: [InvitesController],
  providers: [InvitesService, PrismaService, PermissionsGuard],
  exports: [InvitesService],
})
export class InvitesModule {}
