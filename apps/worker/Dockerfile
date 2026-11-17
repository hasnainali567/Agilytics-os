FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate && pnpm install --filter worker --frozen-lockfile
COPY . .
RUN pnpm --filter worker build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/apps/worker/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
