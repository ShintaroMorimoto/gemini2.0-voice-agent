# zenn-ai-agent-hackathon

Zenn × Google Cloud の 生成 AI エージェントハッカソン提出用

## デモ

- Demo video

## 概要

## ディレクトリ構造

## クイックスタート

### ローカル

1. リポジトリのクローン

```sh
git clone
```

2. 依存関係のインストール(フロントエンド)

```sh
cd frontend && npm i
```

3. フロントエンドの起動

```sh
npm run dev
```

4. 依存関係のインストール(バックエンド)

```sh
cd backend && npm i
```

5. Google Cloud プロジェクトのセットアップ

```sh
gcloud components update
gcloud components install beta
gcloud config set project YOUR-PROJECT-ID
gcloud auth application-default login
```

環境変数は `.env` への追加でも可 (`.env.template` を `.env.local` にリネームしてください)

1. バックエンド WebSocket サーバー起動

```sh
npm run dev
```

### Cloud Run へのデプロイ

```sh
gcloud run deploy --project=YOUR-PROJECT-ID \
--region=us-central1 \
--source=./ \
--allow-unauthenticated \
--port=8000  \
voice-agent
```
