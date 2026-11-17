import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { IdentityController } from "./identity.controller";

@Module({
  controllers: [IdentityController],
  providers: [PrismaService],
})
export class IdentityModule {}
