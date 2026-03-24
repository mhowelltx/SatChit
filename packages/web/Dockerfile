# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src/
COPY packages/web/tsconfig.json ./packages/web/
COPY packages/web/next.config.ts ./packages/web/
COPY packages/web/src ./packages/web/src/

# Build shared so Next.js can resolve the workspace package
RUN pnpm --filter @satchit/shared build

# NEXT_PUBLIC_* vars are baked into the bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN pnpm --filter @satchit/web build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile --prod --filter @satchit/web

COPY --from=builder /app/packages/web/.next ./packages/web/.next/
COPY --from=builder /app/packages/web/next.config.ts ./packages/web/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@satchit/web", "run", "start"]
