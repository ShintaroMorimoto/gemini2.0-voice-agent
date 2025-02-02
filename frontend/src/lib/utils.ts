export type GetAudioContextOptions = AudioContextOptions & {
	id?: string;
};

const map: Map<string, AudioContext> = new Map();

export const audioContext: (
	options?: GetAudioContextOptions,
) => Promise<AudioContext> = (() => {
	const didInteract = new Promise((res) => {
		window.addEventListener('pointerdown', res, { once: true });
		window.addEventListener('keydown', res, { once: true });
	});

	return async (options?: GetAudioContextOptions) => {
		try {
			const a = new Audio();
			// 一部のブラウザではユーザーの操作なしに AudioContext をアクティブ化できないため、
			// このダミーの再生をトリガーとしている
			a.src =
				'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
			await a.play();

			if (options?.id && map.has(options.id)) {
				const ctx = map.get(options.id);
				if (ctx) {
					return ctx;
				}
			}
			const ctx = new AudioContext(options);
			if (options?.id) {
				map.set(options.id, ctx);
			}
			return ctx;
		} catch (e) {
			await didInteract;
			if (options?.id && map.has(options.id)) {
				const ctx = map.get(options.id);
				if (ctx) {
					return ctx;
				}
			}
			const ctx = new AudioContext(options);
			if (options?.id) {
				map.set(options.id, ctx);
			}
			return ctx;
		}
	};
})();

export const blobToJSON = (blob: Blob) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (reader.result) {
				const json = JSON.parse(reader.result as string);
				resolve(json);
			} else {
				reject('Failed to read blob');
			}
		};
		reader.readAsText(blob);
	});

export function base64ToArrayBuffer(base64: string) {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}
