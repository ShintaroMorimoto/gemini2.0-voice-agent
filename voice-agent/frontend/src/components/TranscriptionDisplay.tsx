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
		<div className="fixed top-0 right-0 w-1/2 h-screen bg-gray-900 text-white p-4 overflow-hidden">
			<h2 className="text-xl font-bold mb-4">Conversation</h2>
			<div
				ref={transcriptRef}
				className="h-[calc(100vh-8rem)] overflow-y-auto pr-4 space-y-4 scrollbar-hide"
			>
				{messages.map((message, index) => (
					<div
						key={index}
						className={`flex items-start space-x-2 ${message.role === 'user_ui' ? 'justify-start' : 'justify-end'}`}
					>
						{message.role === 'user_ui' && (
							<User className="w-6 h-6 mt-1 text-blue-500 flex-shrink-0" />
						)}
						<div
							className={`max-w-[80%] p-3 rounded-lg ${
								message.role === 'user_ui'
									? 'bg-blue-500 text-white'
									: 'bg-green-500 text-white'
							}`}
						>
							<p className="text-sm whitespace-pre-wrap">
								{message.content || ''}
							</p>
							<p className="text-xs opacity-75 mt-1">
								{message.timestamp.toLocaleTimeString()}
							</p>
						</div>
						{message.role === 'assistant_ui' && (
							<Bot className="w-6 h-6 mt-1 text-green-500 flex-shrink-0" />
						)}
					</div>
				))}
			</div>
		</div>
	);
}
