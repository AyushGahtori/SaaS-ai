import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  );
}

const markdownComponents = {
  p: ({ children }) => <p className="mb-4 leading-[1.7] last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 text-xl font-semibold leading-[1.4]">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-3 text-lg font-semibold leading-[1.45]">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold leading-[1.5]">{children}</h3>
  ),
};

function formatMarkdownContent(content = '') {
  if (!content) return '';

  return content
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]*---+[ \t]*$/gm, '\n\n')
    .replace(/([^\n])\s*(#{1,6}\s+)/g, '$1\n\n$2')
    .replace(/(\n#{1,6}[^\n]*)\n(?!\n)/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function MessageBubble({ message, mode }) {
  const isUser = message.role === 'user';
  const isHost = mode === 'host';

  const assistantAccent = isHost ? 'border-pink-900/30' : 'border-purple-900/30';
  const assistantBg = isHost ? 'bg-[#1a0f16]' : 'bg-[#0f0f1a]';
  const avatarBg = isHost ? 'bg-[#ec4899]' : 'bg-[#7c3aed]';
  const avatarLabel = isHost ? '🎙️' : '✨';
  const markdownTextColor = isUser ? 'text-[#e2e2f0]' : 'text-[#d8d8f0]';
  const formattedContent = formatMarkdownContent(message.content || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs
          ${isUser ? 'bg-[#252535]' : avatarBg}
          mt-0.5
        `}
      >
        {isUser ? '👤' : avatarLabel}
      </div>

      {/* Bubble */}
      <div
        className={`
          px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-[#252535] text-[#e2e2f0] rounded-tr-sm'
            : `${assistantBg} border ${assistantAccent} text-[#d8d8f0] rounded-tl-sm`
          }
        `}
        style={{ maxWidth: '700px' }}
      >
        {/* Voice badge */}
        {message.fromVoice && (
          <div className="flex items-center gap-1.5 mb-2 opacity-60">
            <span className="text-xs text-pink-400">🎤 voice</span>
          </div>
        )}

        {/* Content */}
        {!isUser && message.content === '' && message.streaming ? (
          <TypingIndicator />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto overflow-x-auto pr-1">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
              className={`prose prose-invert max-w-none ${markdownTextColor}`}
              style={{ maxWidth: '700px', lineHeight: 1.7 }}
            >
              {formattedContent}
            </ReactMarkdown>
            {message.streaming && message.content && (
              <span className="inline-block w-0.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-[10px] mt-1.5 opacity-0 group-hover:opacity-40 transition-opacity
            ${isUser ? 'text-right text-gray-400' : 'text-left text-purple-400'}`}
        >
          {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  );
}
