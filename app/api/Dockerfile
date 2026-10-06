# syntax=docker/dockerfile:1
# Multi-stage image for ECS Fargate. Build context: app/api

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# One-off migration image (ECS task `<name>-api-migrate`, pushed as `:migrate`): the build stage
# plus the schema engine so `prisma migrate deploy` needs no download at run time.
FROM build AS migrate
RUN npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script >/dev/null \
  && chown -R node:node /app
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:20-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "dist/main.js"]
