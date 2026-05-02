import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import AudioPlayer from './AudioPlayer';

function EmptyState({ mode }) {
  const isHost = mode === 'host';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-center px-6"
    >
      <div className={`text-6xl mb-4 ${isHost ? 'animate-bounce-slow' : ''}`}>
        {isHost ? '🎙️' : '✍️'}
      </div>
      <h2 className="text-xl font-semibold text-[#e2e2f0] mb-2">
        {isHost ? "You're On Air" : "Podcast Studio"}
      </h2>
      <p className="text-[#6b6b8a] text-sm max-w-sm leading-relaxed">
        {isHost
          ? "ARIA is live and ready to host. Click the mic and start talking — or type your message below."
          : "I'm your AI podcast producer. Ask me to write scripts, plan episodes, research topics, or brainstorm ideas."
        }
      </p>

      {/* Suggestions */}
      <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
        {(isHost
          ? ["I want to talk about AI", "Let's discuss startups", "Tell me about creativity", "Explore future of work"]
          : ["Write a 15-min podcast script on climate tech", "Suggest 5 trending podcast topics", "Create a podcast episode structure", "What makes a great podcast hook?"]
        ).map(s => (
          <span key={s} className={`
            px-3 py-1.5 rounded-full text-xs font-medium
            border cursor-default
            ${isHost
              ? 'border-pink-900/40 text-pink-400 bg-pink-950/20'
              : 'border-purple-900/40 text-purple-400 bg-purple-950/20'
            }
          `}>
            {s}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export default function ChatWindow({ messages, isLoading, mode }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState mode={mode} />;
  }

  return (
    <div className="flex flex-col gap-4 py-4 px-4">
      <AnimatePresence initial={false}>
        {messages.map(msg => (
          <div key={msg.id}>
            <MessageBubble message={msg} mode={mode} />
            {/* Audio player for assistant messages in host mode */}
            {msg.role === 'assistant' && !msg.streaming && msg.content && mode === 'host' && (
              <div className="ml-11 mt-1.5">
                <AudioPlayer text={msg.content} mode={mode} />
              </div>
            )}
          </div>
        ))}
      </AnimatePresence>

      {/* Loading indicator when NOT streaming */}
      {isLoading && !messages.some(m => m.streaming) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-3"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0
            ${mode === 'host' ? 'bg-[#ec4899]' : 'bg-[#7c3aed]'}`}>
            {mode === 'host' ? '🎙️' : '✨'}
          </div>
          <div className={`px-4 py-3 rounded-2xl rounded-tl-sm border text-sm
            ${mode === 'host' ? 'bg-[#1a0f16] border-pink-900/30' : 'bg-[#0f0f1a] border-purple-900/30'}`}>
            <div className="flex items-center gap-1 py-1">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
