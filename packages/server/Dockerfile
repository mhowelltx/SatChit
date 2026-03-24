# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src/
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src ./packages/server/src/

# Build shared first, then server
RUN pnpm --filter @satchit/shared build
RUN pnpm --filter @satchit/server build

# Generate Prisma client
RUN pnpm exec prisma generate

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist/
COPY --from=builder /app/packages/server/dist ./packages/server/dist/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma/
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma/

EXPOSE 3001

ENV NODE_ENV=production

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node packages/server/dist/index.js"]
