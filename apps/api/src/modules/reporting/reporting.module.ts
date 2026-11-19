import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TicketsModule } from "../tickets/tickets.module";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";

@Module({
  imports: [TicketsModule],
  controllers: [ReportingController],
  providers: [ReportingService, PrismaService],
})
export class ReportingModule {}
