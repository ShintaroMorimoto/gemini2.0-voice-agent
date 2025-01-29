import { LiveAPIContext } from '@/contexts/LiveAPIContext';
import { useContext, useEffect } from 'react';

export const TranscriptionDisplay = () => {
	const { transcriptionText, ws } = useContext(LiveAPIContext);
	useEffect(() => {
		if (transcriptionText && ws) {
			ws.send(
				JSON.stringify({
					type: 'transcription_update',
					text: transcriptionText,
				}),
			);
		}
	}, [transcriptionText, ws]);

	return (
		<div className="p-4 bg-white rounded shadow">
			<h2 className="text-lg font-semibold mb-2">音声認識結果</h2>
			<p className="text-gray-700 whitespace-pre-wrap leading-none">
				{transcriptionText}
			</p>
		</div>
	);
};
