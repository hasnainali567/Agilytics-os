import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AutomationService } from "./automation.service";
import { AutomationsController } from "./automations.controller";
import { CommitRuleService } from "./commit-rule.service";
import { IntegrationCredentialStore } from "./credential-store.service";
import { GitHubWebhookService } from "./github-webhook.service";
import { ImportController } from "./import/import.controller";
import { ImportService } from "./import/import.service";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { GitHubProvider } from "./providers/github.provider";
import { GoogleProvider } from "./providers/google.provider";
import { NotionProvider } from "./providers/notion.provider";
import { ProviderRegistry } from "./providers/registry";
import { SlackProvider } from "./providers/slack.provider";
import { WebhookProvider } from "./providers/webhook.provider";
import { TokenVaultService } from "./token-vault.service";
import { DailyUpdatesModule } from "../daily-updates/daily-updates.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TicketsModule } from "../tickets/tickets.module";

@Module({
  // [worker-b: automations] NotificationsModule added for AutomationService.
  imports: [TicketsModule, DailyUpdatesModule, NotificationsModule],
  controllers: [IntegrationsController, AutomationsController, ImportController],
  providers: [
    PrismaService,
    TokenVaultService,
    IntegrationCredentialStore,
    ProviderRegistry,
    SlackProvider,
    GitHubProvider,
    NotionProvider,
    GoogleProvider,
    WebhookProvider,
    IntegrationsService,
    // [worker-b: automations] AutomationService + export below.
    AutomationService,
    CommitRuleService,
    GitHubWebhookService,
    ImportService,
  ],
  exports: [AutomationService],
})
export class IntegrationsModule {}
