import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';

function SummarizerComponent() {
	const { summaryText } = useLiveAPIContext();

	return (
		<div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md flex-grow overflow-auto">
			<h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
				Conversation Summary
			</h2>
			{/* <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
			 */}
			<div className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 prose dark:prose-invert max-w-none">
				<ReactMarkdown className="markdown">{summaryText || 'Summary will be displayed here'}</ReactMarkdown>
			</div>
		</div>
	);
}

export const Summarizer = memo(SummarizerComponent);
