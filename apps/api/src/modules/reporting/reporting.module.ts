import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, PrismaService],
})
export class ReportingModule {}
