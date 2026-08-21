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
ENV APP_ROLE=api
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /usr/src/app/dist ./dist

RUN groupadd --gid 1001 nodeapp \
  && useradd --uid 1001 --gid nodeapp --shell /bin/bash --create-home nodeapp
USER nodeapp

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "const http=require('http');const port=process.env.PORT||3000;const prefix=process.env.API_PREFIX||'api';const version=process.env.API_VERSION||'1';const req=http.get({host:'127.0.0.1',port,path:`/${prefix}/v${version}/health/live`,timeout:4000},res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"]
CMD ["node", "dist/main.js"]
