import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { EmailService } from "./common/email/email.service";
import { StorageService } from "./common/storage/storage.service";
import { HealthController } from "./health/health.controller";
import { AdminModule } from "./modules/admin/admin.module";
import { AiModule } from "./modules/ai/ai.module";
import { BoardsModule } from "./modules/boards/boards.module";
import { DailyUpdatesModule } from "./modules/daily-updates/daily-updates.module";
import { DocsModule } from "./modules/docs/docs.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { InvitesModule } from "./modules/identity/invites/invites.module";
import { RolesModule } from "./modules/identity/roles/roles.module";
import { BillingModule } from "./modules/billing/billing.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { ReportingModule } from "./modules/reporting/reporting.module";
import { DashboardLayoutsModule } from "./modules/reporting/dashboard-layouts/dashboard-layouts.module";
import { SprintsModule } from "./modules/sprints/sprints.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { PrismaService } from "./prisma/prisma.service";
import { RealtimeModule } from "./modules/realtime/realtime.module";

/**
 * Modular monolith — one bounded context per module, no cross-module
 * imports (see ARCHITECTURE.md). Shared contracts live in @agilytics/shared.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    AdminModule,
    AiModule,
    BillingModule,
    BoardsModule,
    DailyUpdatesModule,
    DocsModule,
    IdentityModule,
    InvitesModule,
    IntegrationsModule,
    NotificationsModule,
    ProjectsModule,
    RealtimeModule,
    ReportingModule,
    DashboardLayoutsModule,
    RolesModule,
    SprintsModule,
    TeamsModule,
    TicketsModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    EmailService,
    StorageService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PrismaService, EmailService, StorageService],
})
export class AppModule {}
