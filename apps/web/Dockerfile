FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate && pnpm install --filter web --frozen-lockfile
COPY . .
RUN pnpm --filter web build
CMD ["pnpm", "--filter", "web", "preview", "--host", "0.0.0.0"]
