# syntax=docker/dockerfile:1

FROM node:22.13.1-bookworm-slim AS base
WORKDIR /usr/src/app
COPY package.json package-lock.json ./

# ---- development: dependencies + watch mode ----
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- builder: compiles TypeScript for production ----
FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

# ---- production: minimal runtime image ----
FROM node:22.13.1-bookworm-slim AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /usr/src/app/dist ./dist

RUN groupadd --gid 1001 nodeapp \
  && useradd --uid 1001 --gid nodeapp --shell /bin/bash --create-home nodeapp
USER nodeapp

EXPOSE 3000
CMD ["node", "dist/main.js"]
