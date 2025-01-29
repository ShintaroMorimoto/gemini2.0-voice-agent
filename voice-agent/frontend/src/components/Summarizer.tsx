import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { memo } from 'react';

function SummarizerComponent() {
	const { summaryText } = useLiveAPIContext();

	if (!summaryText) {
		return null;
	}

	return (
		<div className="bg-white/10 rounded-lg p-4 mt-4">
			<h2 className="text-xl font-bold mb-2">会話の要約</h2>
			<p className="whitespace-pre-wrap">{summaryText}</p>
		</div>
	);
}

export const Summarizer = memo(SummarizerComponent);
