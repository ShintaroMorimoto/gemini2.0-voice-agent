FROM node:20-alpine AS base

FROM base AS builder

WORKDIR /app

# バックエンドの依存関係をインストール
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# フロントエンドの依存関係をインストール
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# ソースコードをコピー
COPY backend ./backend
COPY frontend ./frontend

# フロントエンドをビルド
RUN cd frontend && npm run build

# バックエンドのビルドと実行準備
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

# WORKDIR /app/backend

# ポートを公開
EXPOSE 8080

# 環境変数の設定
ENV PORT=8080
ENV NODE_ENV="production"

# コンテナ起動時のコマンド
CMD ["node", "dist/index.js"]