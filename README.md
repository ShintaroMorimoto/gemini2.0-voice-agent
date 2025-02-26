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

[![デモ動画](/thumbnail.png)](https://youtu.be/KNdZgyxNZL4)

## クイックスタート

- 以下 2 パターンを記載しています。
  - ローカルでの実行
  - Cloud Run へデプロイしての実行
- 前提として、以下は完了している想定です。
  - Google Cloud プロジェクトの課金有効化
  - gcloud CLI のインストール

### 共通手順

1. プロジェクト ID を環境変数にセット

```sh
export PROJECT_ID=PROJECT_ID
```

2. gcloud CLI のコンポーネントのアップデートなど

```sh
gcloud components update
gcloud components install beta
```

3. 使用する API を有効化

   - 以下の API を有効化します。
     - Speech-to-Text
     - Vertex AI

```sh
gcloud config set project ${PROJECT_ID}
gcloud services enable speech.googleapis.com aiplatform.googleapis.com --project=${PROJECT_ID}
```

4. リポジトリのクローン

```sh
git clone https://github.com/ShintaroMorimoto/gemini2.0-voice-agent.git
```

### ローカルでの実行

1. 依存関係のインストール(フロントエンド)

```sh
cd frontend && npm ci
```

2. フロントエンドの起動

```sh
npm run dev
```

3. 依存関係のインストール(バックエンド)

```sh
cd backend && npm ci
```

4. 環境変数の設定

   - `.env.template` を `.env.local` にリネームして、プロジェクト ID を設定してください。

5. (オプション)プロンプトの修正

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

6. 認証

```sh
gcloud auth application-default login
```

7. バックエンドの起動

```sh
npm run dev
```

### Cloud Run へのデプロイ

1. 認証

```sh
gcloud auth login
```

2. デプロイ

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

- 以下のエラーが出る場合は、Cloud Build の設定から Cloud Run 管理者を有効にしてください。
  - 表示されるポップアップは skip を選択してください。

```sh
 (gcloud.run.deploy) PERMISSION_DENIED: The caller does not have permission. This command is authenticated as MAIL@EXAMPLE.COM which is the active account specified by the [core/account] property
```

![ビルド時のエラー](/builderror.png)
