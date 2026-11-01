FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 ARCHIVE_DATA_DIR=/data
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
