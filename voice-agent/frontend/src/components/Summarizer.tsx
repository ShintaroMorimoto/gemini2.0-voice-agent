import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';

function SummarizerComponent() {
	const { summaryText } = useLiveAPIContext();

	return (
		<div>
			<h2 className="text-xl font-bold mb-4 text-slate-100">Summary</h2>
			<div className="text-sm text-slate-400">
				<ReactMarkdown className="markdown">
					{summaryText || 'Summary will be displayed here'}
				</ReactMarkdown>
			</div>
		</div>
	);
}

export const Summarizer = memo(SummarizerComponent);
