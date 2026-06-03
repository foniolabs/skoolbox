import { Bot, User } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../stores/useChatStore';

interface ChatMessageProps {
  message: ChatMessageType;
}

function formatContent(content: string) {
  const lines = content.split('\n');

  return lines.map((line, i) => {
    // Bold formatting: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={j} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    // Bullet points
    const isBullet = line.trimStart().startsWith('- ') || line.trimStart().startsWith('* ');

    if (isBullet) {
      const bulletContent = line.replace(/^\s*[-*]\s/, '');
      const bulletParts = bulletContent.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={j} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      return (
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-primary">&#8226;</span>
          <span>{bulletParts}</span>
        </div>
      );
    }

    return (
      <span key={i}>
        {formatted}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-primary' : 'bg-blue-500'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-white rounded-tr-sm'
              : 'bg-white text-text-primary shadow-sm border border-gray-100 rounded-tl-sm'
          }`}
        >
          {formatContent(message.content)}
        </div>
        <p
          className={`text-xs text-text-muted mt-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
