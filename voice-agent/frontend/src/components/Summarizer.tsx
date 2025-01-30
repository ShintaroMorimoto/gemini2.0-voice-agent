import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { memo } from 'react';

function SummarizerComponent() {
	const { summaryText } = useLiveAPIContext();

	return (
		<div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md flex-grow overflow-auto">
			<h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
				Conversation Summary
			</h2>
			<p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
				{summaryText || 'Summary will be displayed here'}
			</p>
		</div>
	);
}

export const Summarizer = memo(SummarizerComponent);
