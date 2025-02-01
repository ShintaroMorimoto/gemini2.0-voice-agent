import { Bot, User } from 'lucide-react';
import { useContext, useEffect, useRef, useState } from 'react';
import { LiveAPIContext } from '../contexts/LiveAPIContext';

interface Message {
	role: 'user_ui' | 'assistant_ui';
	content: string;
	timestamp: Date;
}

export default function Transcript() {
	const [messages, setMessages] = useState<Message[]>([]);
	const transcriptRef = useRef<HTMLDivElement>(null);
	const { transcriptionText } = useContext(LiveAPIContext);

	// transcriptionTextが更新されたときにメッセージを追加
	useEffect(() => {
		if (!transcriptionText) return;

		const lines = transcriptionText.trim().split('\n');
		const newMessages: Message[] = [];

		for (const line of lines) {
			if (!line.trim()) continue;

			if (line.startsWith('AI：')) {
				newMessages.push({
					role: 'assistant_ui',
					content: line.substring(3).trim(),
					timestamp: new Date(),
				});
			} else if (line.startsWith('あなた：')) {
				newMessages.push({
					role: 'user_ui',
					content: line.substring(4).trim(),
					timestamp: new Date(),
				});
			}
		}

		if (newMessages.length > 0) {
			setMessages(newMessages);
		}
	}, [transcriptionText]);

	// メッセージが更新されたときにスクロール
	useEffect(() => {
		if (transcriptRef.current) {
			transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
		}
	}, [messages]);

	return (
		<div className="h-screen bg-gray-900 text-gray-100 p-6 overflow-hidden w-full">
			<h2 className="text-xl font-bold mb-6 text-gray-200">Conversation</h2>
			<div
				ref={transcriptRef}
				className="h-[calc(100vh-8rem)] overflow-y-auto pr-4 space-y-6 scrollbar-hide"
			>
				{messages.map((message, index) => (
					<div
						key={index}
						className={`flex items-start space-x-4 ${message.role === 'user_ui' ? 'justify-start' : 'justify-end'}`}
					>
						{message.role === 'user_ui' && (
							<User className="w-6 h-6 mt-2 text-blue-700 flex-shrink-0" />
						)}
						<div
							className={`max-w-[80%] p-4 rounded-lg ${
								message.role === 'user_ui'
									? 'bg-blue-900 text-gray-100 mb-3'
									: 'bg-green-900 text-gray-100 mb-3'
							}`}
						>
							<p className="text-sm whitespace-pre-wrap">
								{message.content || ''}
							</p>
							<p className="text-xs opacity-70 mt-1">
								{message.timestamp.toLocaleTimeString()}
							</p>
						</div>
						{message.role === 'assistant_ui' && (
							<Bot className="w-6 h-6 mt-2 text-green-700 flex-shrink-0" />
						)}
					</div>
				))}
			</div>
		</div>
	);
}
