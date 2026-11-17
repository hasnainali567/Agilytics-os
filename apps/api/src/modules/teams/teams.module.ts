import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TeamsController } from "./teams.controller";

@Module({
  controllers: [TeamsController],
  providers: [PrismaService],
})
export class TeamsModule {}
