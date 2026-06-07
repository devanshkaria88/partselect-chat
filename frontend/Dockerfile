# Build context is the repo root (see docker-compose.yml).
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY frontend ./frontend
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @partselect/types build \
 && pnpm --filter frontend build

FROM node:22-slim AS run
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# Next.js standalone output (tracing root = repo root → app under /frontend).
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
