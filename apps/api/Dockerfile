FROM node:22-bookworm AS deps
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/study-format/package.json packages/study-format/package.json

RUN pnpm install --frozen-lockfile

FROM oven/bun:1 AS build
WORKDIR /app

COPY --from=deps /app /app
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
COPY packages/study-format ./packages/study-format

ENV NODE_ENV=production

RUN bun build --compile --minify-whitespace --minify-syntax --target bun-linux-x64 --outfile server apps/api/src/index.ts

FROM gcr.io/distroless/base:nonroot
WORKDIR /app

COPY --from=build --chown=nonroot:nonroot /app/server ./server
COPY --from=build --chown=nonroot:nonroot /app/apps/api/drizzle ./drizzle
ENV NODE_ENV=production
CMD ["./server"]
EXPOSE 3001
