import { Badge } from '@/components/ui/badge';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { useContext, useEffect, useRef, useState } from 'react';
import { LiveAPIContext } from '../contexts/LiveAPIContext';

interface Message {
	role: 'user_ui' | 'assistant_ui';
	content: string;
	timestamp: Date;
}

export default function Transcript() {
	const [messages, setMessages] = useState<Message[]>([]);
	const viewportRef = useRef<HTMLDivElement>(null);
	const { transcriptionText } = useContext(LiveAPIContext);

	// メッセージが更新されたときにスクロール
	useEffect(() => {
		if (viewportRef.current) {
			const scrollContainer = viewportRef.current;
			const scrollToBottom = () => {
				requestAnimationFrame(() => {
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
				});
			};

			// 初回スクロール
			scrollToBottom();

			// 100ms後に再度スクロール（コンテンツの読み込みが完了している可能性が高い）
			const timeoutId = setTimeout(scrollToBottom, 100);

			return () => clearTimeout(timeoutId);
		}
	}, [messages]);

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

	return (
		<div className="p-6">
			<h2 className="text-xl font-bold mb-6 text-slate-100">Conversation</h2>
			<ScrollAreaPrimitive.Root className="h-[600px] pr-4 relative overflow-hidden">
				<ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]">
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
				</ScrollAreaPrimitive.Viewport>
				<ScrollAreaPrimitive.Scrollbar
					className="flex select-none touch-none p-0.5 transition-colors duration-150 ease-out w-0.5 opacity-0"
					orientation="vertical"
				>
					<ScrollAreaPrimitive.Thumb className="flex-1 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
				</ScrollAreaPrimitive.Scrollbar>
				<ScrollAreaPrimitive.Corner />
			</ScrollAreaPrimitive.Root>
		</div>
	);
}
