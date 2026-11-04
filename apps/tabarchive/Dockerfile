FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/tabarchive/package.json ./apps/tabarchive/package.json
RUN corepack enable && pnpm --filter tabarchive install --frozen-lockfile
COPY apps/tabarchive ./apps/tabarchive
RUN pnpm --filter tabarchive build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 ARCHIVE_DATA_DIR=/data
COPY --from=build --chown=node:node /app/apps/tabarchive/.output ./.output
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
