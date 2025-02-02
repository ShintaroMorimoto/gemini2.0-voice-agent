import { GoogleAuth } from 'google-auth-library';
import type { GeminiResponse } from '../types/multimodal-live-api.d.ts';

export class SummarizeService {
	private project: string;
	private location: string;
	private auth: GoogleAuth;

	constructor(project: string, location: string) {
		if (!project) {
			throw new Error('PROJECT is not set');
		}
		if (!location) {
			throw new Error('LOCATION is not set');
		}

		this.project = project;
		this.location = location;
		this.auth = new GoogleAuth({
			scopes: ['https://www.googleapis.com/auth/cloud-platform'],
		});
	}

	public async summarize(conversation_history: string): Promise<string> {
		const apiHost = `${this.location}-aiplatform.googleapis.com`;
		const modelId = 'gemini-2.0-flash-exp';
		const apiEndpoint = `${apiHost}/v1/projects/${this.project}/locations/${this.location}/publishers/google/models/${modelId}:generateContent`;

		const query = `\
      会話内容を要約してください。
      出力は以下のようなマークダウン形式で、箇条書きにしてください。

      形式の例
      ### 採用したいポジションの名前
      - 採用したいポジションの名前をここに記載
      ### 募集背景(なぜ採用したいのか)
      - 募集背景をここに記載
      ### 具体的な業務内容
      - 具体的な業務内容をここに記載
      ### 採用したい人の特徴(スキルや経験、正確など)
      - 採用したい人の特徴をここに記載
      ### ポジションの魅力(成長機会や他社との違いなど)
      - ポジションの魅力をここに記載
      ### キャリアパス(成果を出していくと、どのようなキャリアパスがあるか)
      - キャリアパスをここに記載

      以下が要約してほしい会話内容です。
      ${conversation_history}`;

		const data = {
			contents: {
				role: 'USER',
				parts: { text: query },
			},
			generation_config: {
				response_modalities: 'TEXT',
			},
		};

		try {
			const client = await this.auth.getApplicationDefault();
			const token = await client.credential.getAccessToken();

			const result = await fetch(`https://${apiEndpoint}`, {
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token.token}`,
				},
				method: 'POST',
				body: JSON.stringify(data),
			});

			if (!result.ok) {
				throw new Error(`API request failed with status ${result.status}`);
			}

			const responseData = (await result.json()) as GeminiResponse;
			const summaryText = responseData.candidates[0]?.content.parts[0]?.text;

			if (!summaryText) {
				throw new Error('No summary text found in response');
			}

			console.log('Summary:', summaryText);
			return summaryText;
		} catch (error) {
			console.error('Error fetching summarize:', error);
			throw error;
		}
	}
}
