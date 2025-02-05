## リポジトリの概要

- [AI Agent Hackathon with Google Cloud](https://zenn.dev/hackathons/2024-google-cloud-japan-ai-hackathon) 提出用
- [紹介記事]()

## Web アプリの概要

- ブラウザ上で Gemini 2.0 と音声で対話できます。

### 機能

- Connect / Disconnect ボタンで接続状態の管理
- Mic Off / Mic On ボタンで音声入力可否の切り替え
- 特定テーマに対して Gemini がヒアリング
  - 初期設定は中途採用で募集したいポジションの詳細
- 発言内容をリアルタイムで表示
- 会話終了時にはその内容の要約を表示

### デモ

- Demo video

## クイックスタート

### ローカル

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

5. Google Cloud プロジェクトのセットアップ

```sh
gcloud components update
gcloud components install beta
gcloud config set project PROJECT-ID
gcloud auth application-default login
```

6. Speech-To-Text API の有効化

7. 環境変数の設定

- `.env.template` を `.env.local` にリネームして、プロジェクト ID を設定してください

8. (オプション)プロンプトの修正

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
	- "なぜその業務をやるのか" "なぜその経験が必要なのか"といった、目的や背景を深堀りする質問をしてください。\
	- クライアントから抽象的な回答があった場合は、それを具体化(定量化)する深堀り質問をしてください。\
	- クライアントが回答に困っていそうな場合は、具体例や仮説を出して、クライアントのアイデアが出やすくなるような問いかけをしてください。\
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

9. バックエンド WebSocket サーバー起動

```sh
npm run dev
```

### Cloud Run へのデプロイ

1. デプロイ

- `PROJECT_ID`の部分を変更して実行してください
- 実行すると「Cloud Build の API をオンにして良いですか？」や「Artifact Registry のリポジトリを作っても良いですか？」といった確認コマンドが出る場合がありますので、yes で進めてください。

```sh
gcloud run deploy --project=PROJECT_ID \
--region=us-central1 \
--source=./ \
--allow-unauthenticated \
--port=8080  \
--set-env-vars=PROJECT=PROJECT_ID,LOCATION=us-central1,VERSION=v1beta1 \
voice-agent
```
