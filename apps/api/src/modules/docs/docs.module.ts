import { Module } from "@nestjs/common";
import { StorageService } from "../../common/storage/storage.service";
import { PrismaService } from "../../prisma/prisma.service";
import { DocsController } from "./docs.controller";

@Module({
  controllers: [DocsController],
  providers: [PrismaService, StorageService],
})
export class DocsModule {}
