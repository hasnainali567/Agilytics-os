// Prisma 7 config — the Prisma CLI reads its database connection from
// here, NOT from schema.prisma (the datasource `url` field was removed
// in Prisma 7).
//
// - `datasource.url` = DIRECT_URL, the Neon NON-pooler (direct) URL.
//   The CLI uses this for migrations (`prisma migrate dev`, `prisma db
//   push`, `prisma validate`); DDL must not run through a pooler.
// - The app runtime does NOT use this file: it connects through the
//   PrismaPg driver adapter in src/prisma/prisma.service.ts, using
//   DATABASE_URL (the Neon pooler URL). See apps/api/.env.example.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 no longer auto-runs the seed after `migrate dev`;
    // run it explicitly with `prisma db seed`.
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
