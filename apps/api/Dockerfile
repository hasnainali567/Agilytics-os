FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate && pnpm install --filter api --frozen-lockfile
COPY . .
# Prisma 7 does not auto-generate the client on install. Generate it before
# the Nest build (DIRECT_URL is only read by prisma.config.ts; generate
# never connects to a database, so a dummy value is enough here).
RUN DIRECT_URL="postgresql://user:pass@localhost:5432/agilytics" pnpm --filter api exec prisma generate
RUN pnpm --filter api build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
