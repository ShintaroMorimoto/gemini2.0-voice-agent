FROM node:20-alpine AS base

FROM base AS builder

RUN apk add --no-cache sox

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY backend ./backend
COPY frontend ./frontend

RUN cd frontend && npm run build

RUN cd backend && npm run build

FROM base AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/backend/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/backend/package.json ./package.json
COPY --from=builder /app/frontend/dist ./public

USER appuser


EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV="production"

CMD ["node", "dist/index.js"]