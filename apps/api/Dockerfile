FROM node:22-alpine AS builder
RUN npm install --global pnpm@10.17.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/billing/package.json packages/billing/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @sesb/database db:generate && pnpm --filter @sesb/api build

FROM node:22-alpine AS runtime
RUN npm install --global pnpm@10.17.1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY scripts/start-api.sh ./scripts/start-api.sh
RUN chmod +x ./scripts/start-api.sh
EXPOSE 3000
CMD ["./scripts/start-api.sh"]
