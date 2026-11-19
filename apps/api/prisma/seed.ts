// Must be first: ts-node does not load .env on its own, so without this
// process.env.DATABASE_URL is undefined and PrismaPg defaults to
// localhost:5432 -> ECONNREFUSED, no matter what is in apps/api/.env.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 requires a driver adapter. Seed connects through the Neon
// pooler URL (DATABASE_URL); run with `prisma db seed` after migrate.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Fixed id "demo-tenant": the web app's dev-login (apps/web/src/lib/authFetch.ts)
  // logs in as tenant demo-tenant, so the seeded org must have that id or
  // the dashboard queries a tenant with no data.
  const org = await prisma.organisation.upsert({
    where: { slug: "demo" },
    update: {},
    create: { id: "demo-tenant", name: "Demo Organisation", slug: "demo" },
  });
  const user = await prisma.user.upsert({
    where: { email: "demo@agilytics.local" },
    update: {},
    create: { id: "demo-user", email: "demo@agilytics.local", name: "Demo User" },
  });
  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: org.id, userId: user.id } },
    update: {},
    create: { tenantId: org.id, userId: user.id, role: "OWNER" },
  });
  const project = await prisma.project.create({
    data: {
      tenantId: org.id,
      key: "WEB",
      name: "Website Redesign",
      description: "Seed project — delete before real use.",
    },
  });
  const sprint = await prisma.sprint.create({
    data: {
      tenantId: org.id,
      projectId: project.id,
      name: "Sprint 1",
      goal: "Ship the new dashboard shell.",
      startDate: new Date("2026-11-17"),
      endDate: new Date("2026-11-30"),
      status: "ACTIVE",
    },
  });
  const board = await prisma.board.create({
    data: {
      tenantId: org.id,
      projectId: project.id,
      name: "Main board",
      isDefault: true,
      columns: {
        create: [
          { tenantId: org.id, name: "Backlog", order: 0, colour: "#64748B", category: "TODO" },
          { tenantId: org.id, name: "To Do", order: 1, colour: "#3B82F6", category: "TODO" },
          {
            tenantId: org.id,
            name: "In Progress",
            order: 2,
            colour: "#F59E0B",
            category: "IN_PROGRESS",
          },
          {
            tenantId: org.id,
            name: "Review",
            order: 3,
            colour: "#8B5CF6",
            category: "IN_PROGRESS",
          },
          { tenantId: org.id, name: "Done", order: 4, colour: "#22C55E", category: "DONE" },
        ],
      },
    },
    include: { columns: true },
  });
  const inProgress = board.columns.find((c) => c.name === "In Progress");
  await prisma.ticket.create({
    data: {
      tenantId: org.id,
      projectId: project.id,
      sprintId: sprint.id,
      boardId: board.id,
      statusId: inProgress?.id,
      key: "WEB-1",
      title: "Build the Home dashboard",
      priority: "HIGH",
      estimate: 5,
    },
  });
  console.log(`Seeded org ${org.id}, project ${project.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
