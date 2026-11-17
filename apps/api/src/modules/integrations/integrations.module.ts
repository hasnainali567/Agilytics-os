import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IntegrationsController } from "./integrations.controller";
import { GitHubProvider } from "./providers/github.provider";
import { ProviderRegistry } from "./providers/registry";
import { SlackProvider } from "./providers/slack.provider";

@Module({
  controllers: [IntegrationsController],
  providers: [PrismaService, ProviderRegistry, SlackProvider, GitHubProvider],
})
export class IntegrationsModule {}
