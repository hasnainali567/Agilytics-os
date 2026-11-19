import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SprintsController } from "./sprints.controller";
import { SprintsService } from "./sprints.service";

@Module({
  controllers: [SprintsController],
  providers: [PrismaService, SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
