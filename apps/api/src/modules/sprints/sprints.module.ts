import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SprintsController } from "./sprints.controller";

@Module({
  controllers: [SprintsController],
  providers: [PrismaService],
})
export class SprintsModule {}
