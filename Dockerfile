FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --include=dev
COPY apps/api apps/api
RUN npm run build

FROM node:24.21.0-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --omit=dev --omit=optional
COPY --from=build /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
