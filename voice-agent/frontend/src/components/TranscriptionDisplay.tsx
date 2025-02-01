import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
		<div className="p-6">
			<h2 className="text-xl font-bold mb-6 text-slate-100">Conversation</h2>
			<ScrollArea className="h-[600px] pr-4">
				<div className="space-y-4">
					{messages.map((message, index) => (
						<div
							key={index}
							className={`flex ${message.role === 'user_ui' ? 'justify-start' : 'justify-end'}`}
						>
							<div
								className={`
									relative max-w-[80%] rounded-lg p-4 text-sm
									${
										message.role === 'assistant_ui'
											? 'bg-emerald-600/20 text-emerald-100'
											: 'bg-blue-600/20 text-blue-100'
									}
								`}
							>
								<p className="whitespace-pre-wrap">{message.content}</p>
								<Badge
									variant="secondary"
									className="absolute -bottom-2 right-2 bg-slate-800/90 text-xs"
								>
									{message.timestamp.toLocaleTimeString()}
								</Badge>
							</div>
						</div>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}
