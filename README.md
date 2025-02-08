## リポジトリの概要

- [AI Agent Hackathon with Google Cloud](https://zenn.dev/hackathons/2024-google-cloud-japan-ai-hackathon) 提出用
- [Zenn の紹介記事](https://zenn.dev/mrmtsntr/articles/3859ec6b61b63b)

## Web アプリの概要

- Gemini 2.0 が特定テーマについて音声でヒアリングします。

### 機能

- Connect / Disconnect ボタンで接続状態の管理
- Mic On / Mic Off ボタンで音声入力可否の切り替え
- プロンプトで設定した特定テーマについて Gemini がヒアリング
  - 初期設定は中途採用で募集したいポジションの詳細
- 発言内容をリアルタイムで表示
- 会話終了時にはその内容の要約を表示

### デモ (YouTube へのリンクです)

[![デモ動画](/thumbnail.png)](https://youtube.com/watch?v=wKNdZgyxNZL4)

## クイックスタート

### ローカルでの実行

1. リポジトリのクローン

```sh
git clone https://github.com/ShintaroMorimoto/gemini2.0-voice-agent.git
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

5. 各種セットアップ

- 前提として、以下は完了している想定です。
  - Google Cloud プロジェクトの課金有効化
  - gcloud CLI のインストール

```sh
gcloud components update
gcloud components install beta
gcloud config set project PROJECT_ID
gcloud auth application-default login
```

1. 各種 API の有効化

- 以下の API をコンソール画面からそれぞれ有効化してください。
  - Speech-to-Text
  - Vertex AI

1. 環境変数の設定

- `.env.template` を `.env.local` にリネームして、プロジェクト ID を設定してください。

8. (オプション)プロンプトの修正

- 必要に応じて `backend/index.ts` のプロンプトを修正してください。
- デフォルトでは以下のようになっています。

```typescript
const persona = '中途採用のプロフェッショナル';
const instructions = `
	クライアントが採用したいポジションについて、ヒアリングを行ってください。
	第一声では必ず「この度はお時間ありがとうございます。早速ですが、採用したいポジションについて教えていただけますか。」と言ってください。
	## 以下が明確になるまで、ヒアリングを続けてください。
	- 採用したいポジションの名前
	- 募集背景(なぜ採用したいのか)
	- 具体的な業務内容
	- 採用したい人の特徴(スキルや経験、正確など)
	- ポジションの魅力(成長機会や他社との違いなど)
	- キャリアパス(成果を出していくと、どのようなキャリアパスがあるか)

	## ヒアリングで意識してほしい点
	- "なぜその業務をやるのか" "なぜその経験が必要なのか"といった、目的や背景を深堀りする質問をしてください。
	- クライアントから抽象的な回答があった場合は、それを具体化(定量化)する深堀り質問をしてください。
	- クライアントが回答に困っていそうな場合は、具体例や仮説を出して、クライアントのアイデアが出やすくなるような問いかけをしてください。

	## ツールの使用
	- ヒアリングが終わったら、summarizeツールを使用してヒアリング内容を要約してください。
		- ヒアリング内容は、画面左側に表示されます。
	- 要約したヒアリング内容について、クライアントとの認識齟齬がないか確認してください。
		- 認識齟齬がある場合はヒアリングを再開して、summarizeツールを再度実行してください。
	`;

const setUpPrompt = `
	あなたは${persona}です。
	<instructions>
	${sampleInstructions}
	</instructions>
    `;
```

9. バックエンドの起動

```sh
npm run dev
```

### Cloud Run へのデプロイ

1. プロジェクト ID を環境変数にセット

```sh
export PROJECT_ID=PROJECT_ID
```

2. 認証

```sh
gcloud config set project ${PROJECT_ID}
gcloud auth login
```

3. デプロイ

- 実行すると初回は「必要な API をオンにして良いですか？」や「Artifact Registry のリポジトリを作っても良いですか？」といった確認コマンドが出る場合がありますので、yes で進めてください。

```sh
gcloud run deploy --project=${PROJECT_ID} \
--region=us-central1 \
--source=./ \
--allow-unauthenticated \
--port=8080  \
--set-env-vars=PROJECT=${PROJECT_ID},LOCATION=us-central1,VERSION=v1beta1 \
voice-agent
```
