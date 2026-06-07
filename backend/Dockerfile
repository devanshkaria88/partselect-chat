# Build context is the repo root (see docker-compose.yml) so workspace deps resolve.
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY backend ./backend
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @partselect/types build \
 && pnpm --filter backend build

FROM node:22-slim AS run
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node
WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/main.js"]
