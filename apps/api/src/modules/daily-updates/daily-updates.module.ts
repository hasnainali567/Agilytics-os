import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DailyUpdatesController } from "./daily-updates.controller";
import { DailyUpdatesService } from "./daily-updates.service";

@Module({
  controllers: [DailyUpdatesController],
  providers: [DailyUpdatesService, PrismaService],
})
export class DailyUpdatesModule {}
