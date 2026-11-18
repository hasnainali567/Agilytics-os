import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 requires a driver adapter — `new PrismaClient()` with no
    // adapter throws. DATABASE_URL is the Neon pooler URL (port 6543);
    // migrations use DIRECT_URL (prisma.config.ts) and never touch this
    // adapter. In tests this service is mocked, so a missing DATABASE_URL
    // only fails when a real query runs, not at construction.
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });
  }

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
