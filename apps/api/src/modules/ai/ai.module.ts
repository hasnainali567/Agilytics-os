import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiController } from "./ai.controller";
import { AgentService } from "./agent.service";

@Module({
  controllers: [AiController],
  providers: [AgentService, PrismaService],
})
export class AiModule {}
