import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';

function SummarizerComponent() {
	const { summaryText } = useLiveAPIContext();

	return (
		<div className="bg-gray-100 p-3 rounded-md">
			<h2 className="text-lg font-semibold mb-1 text-gray-800">
				Conversation Summary
			</h2>
			<div className="text-sm leading-relaxed text-gray-600 prose max-w-none">
				<ReactMarkdown className="markdown">
					{summaryText || 'Summary will be displayed here'}
				</ReactMarkdown>
			</div>
		</div>
	);
}

export const Summarizer = memo(SummarizerComponent);
