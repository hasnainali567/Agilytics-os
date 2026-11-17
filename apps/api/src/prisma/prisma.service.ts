import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set the Postgres session tenant for RLS. Call once per request
   * (middleware/interceptor) with the tenant_id from the Cognito JWT.
   * Every RLS policy compares against `app.tenant_id`.
   */
  async setTenant(tenantId: string) {
    await this.$executeRawUnsafe(`SET LOCAL "app.tenant_id" = '${tenantId}'`);
  }
}
