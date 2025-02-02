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
cd frontend && npm ci
```

3. フロントエンドの起動

```sh
npm run dev
```

4. 依存関係のインストール(バックエンド)

```sh
cd backend && npm ci
```

5. Google Cloud プロジェクトのセットアップ

```sh
gcloud components update
gcloud components install beta
gcloud config set project YOUR-PROJECT-ID
gcloud auth application-default login
```

環境変数は `.env` への追加でも可 (`.env.template` を `.env.local` にリネームしてください)

6. (オプション)プロンプトの修正

- 必要に応じて `backend/index.ts` のプロンプトを修正してください。
- デフォルトでは以下のようになっています。

```typescript
const persona = '中途採用のプロフェッショナル';
const instructions = `\
	クライアントが採用したいポジションについて、ヒアリングを行ってください。\
	## 以下が明確になるまで、ヒアリングを続けてください。\
	- 採用したいポジションの名前 \
	- 募集背景(なぜ採用したいのか) \
	- 具体的な業務内容 \
	- 採用したい人の特徴(スキルや経験、正確など) \
	- ポジションの魅力(成長機会や他社との違いなど) \
	- キャリアパス(成果を出していくと、どのようなキャリアパスがあるか) \
	\
	## ヒアリングで意識してほしい点 \
	- 「なぜその業務をやるのか」「なぜその経験が必要なのか」といった、目的や背景を深堀りする質問をしてくだ
	- クライアントから抽象的な回答があった場合は、それを具体化(定量化)する深堀り質問をしてください。\
	- クライアントが回答に困っていそうな場合は、具体例や仮説を出して、クライアントのアイデアが出やすくなる
	\
	## ツールの使用 \
	- ヒアリングが終わったら、summarizeツールを使用してヒアリング内容を要約してください。
		- ヒアリング内容は、画面左側に表示されます。\
	- 要約したヒアリング内容について、クライアントとの認識齟齬がないか確認してください。\
		- 認識齟齬がある場合はヒアリングを再開して、summarizeツールを再度実行してください。\
	`;

const setUpPrompt = `\
	あなたは${persona}です。\
	<instructions>
	${sampleInstructions}
	</instructions>
	\
    `;
```

7. バックエンド WebSocket サーバー起動

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
--set-env-vars PROJECT=YOUR-PROJECT-ID,LOCATION=us-central1,VERSION=v1beta1
voice-agent
```

--set-env-vars のところはもしかしたら変数ごとに `--set-env-vars` しないとダメかも(動かして確認)
