import { Module } from "@nestjs/common";
import { StorageService } from "../../common/storage/storage.service";
import { PrismaService } from "../../prisma/prisma.service";
import { DocsController } from "./docs.controller";
import { DocsService } from "./docs.service";

@Module({
  controllers: [DocsController],
  providers: [DocsService, PrismaService, StorageService],
})
export class DocsModule {}
