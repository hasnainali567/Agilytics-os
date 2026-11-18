import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CommitRuleService } from "./commit-rule.service";
import { GitHubWebhookService } from "./github-webhook.service";
import { ImportController } from "./import/import.controller";
import { ImportService } from "./import/import.service";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { GitHubProvider } from "./providers/github.provider";
import { ProviderRegistry } from "./providers/registry";
import { SlackProvider } from "./providers/slack.provider";
import { DailyUpdatesModule } from "../daily-updates/daily-updates.module";
import { TicketsModule } from "../tickets/tickets.module";

@Module({
  imports: [TicketsModule, DailyUpdatesModule],
  controllers: [IntegrationsController, ImportController],
  providers: [
    PrismaService,
    ProviderRegistry,
    SlackProvider,
    GitHubProvider,
    IntegrationsService,
    CommitRuleService,
    GitHubWebhookService,
    ImportService,
  ],
})
export class IntegrationsModule {}
