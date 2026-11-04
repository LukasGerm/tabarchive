FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/musictrainer/package.json ./apps/musictrainer/package.json
RUN corepack enable && pnpm --filter musictrainer install --frozen-lockfile
COPY apps/musictrainer ./apps/musictrainer
RUN pnpm --filter musictrainer build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY apps/musictrainer/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/musictrainer/dist /usr/share/nginx/html
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
