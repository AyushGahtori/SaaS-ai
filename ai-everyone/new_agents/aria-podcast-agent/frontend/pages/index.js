import { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../hooks/useChat';
import { useVoice } from '../hooks/useVoice';
import ChatWindow from '../components/ChatWindow';
import ModeToggle from '../components/ModeToggle';
import MicButton from '../components/MicButton';

export default function Home() {
  const [input, setInput] = useState('');
  const [useStream, setUseStream] = useState(true);
  const inputRef = useRef(null);

  const {
    messages,
    isLoading,
    sessionId,
    mode,
    sendChatMessage,
    switchMode,
    addVoiceResult,
    reset,
  } = useChat();

  const {
    isRecording,
    isProcessing,
    isPlaying,
    error: voiceError,
    toggleRecording,
    speakText,
  } = useVoice({
    sessionId,
    mode,
    onResult: addVoiceResult,
  });

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!sessionId || !text || isLoading) return;
    setInput('');
    await sendChatMessage(text, useStream);
  }, [input, isLoading, sendChatMessage, sessionId, useStream]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleModeSwitch = useCallback(async (newMode) => {
    if (newMode === mode) return;
    await switchMode(newMode);
  }, [mode, switchMode]);

  const isHostMode = mode === 'host';
  const accentColor = isHostMode ? '#ec4899' : '#7c3aed';
  const accentHover = isHostMode ? 'hover:bg-[#be185d]' : 'hover:bg-[#6d28d9]';
  const accentBg = isHostMode ? 'bg-[#ec4899]' : 'bg-[#7c3aed]';

  return (
    <>
      <Head>
        <title>ARIA — AI Podcast Agent</title>
        <meta name="description" content="AI-powered podcast host and creator" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎙️</text></svg>" />
      </Head>

      <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 bg-[#0d0d14] border-r border-[#1a1a28] flex flex-col">
          {/* Logo */}
          <div className="p-5 border-b border-[#1a1a28]">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg
                ${isHostMode ? 'bg-pink-900/40 host-glow' : 'bg-purple-900/40'}`}>
                🎙️
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#e2e2f0] tracking-wide">ARIA</h1>
                <p className="text-[10px] text-[#6b6b8a]">AI Podcast Agent</p>
              </div>
            </div>
          </div>

          {/* Mode */}
          <div className="p-4 border-b border-[#1a1a28]">
            <p className="text-[10px] font-semibold text-[#6b6b8a] uppercase tracking-widest mb-3">Mode</p>
            <ModeToggle mode={mode} onSwitch={handleModeSwitch} disabled={isLoading} />
          </div>

          {/* Mode info */}
          <div className="p-4 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {isHostMode ? (
                  <>
                    <p className="text-xs font-semibold text-pink-400 mb-2">🎙️ Host Mode</p>
                    <p className="text-[11px] text-[#6b6b8a] leading-relaxed">
                      ARIA is your live podcast host — conversational, emotional, and engaging.
                      Use voice or text to have a real podcast conversation.
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {['Real-time voice conversation', 'Auto TTS responses', 'Emotional reactions', 'Follow-up questions'].map(f => (
                        <div key={f} className="flex items-center gap-2 text-[11px] text-[#4a4a6a]">
                          <div className="w-1 h-1 rounded-full bg-pink-500/60" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-purple-400 mb-2">✍️ Creator Mode</p>
                    <p className="text-[11px] text-[#6b6b8a] leading-relaxed">
                      ARIA is your podcast producer — creates scripts, plans episodes, researches topics.
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {['Full podcast scripts', 'Episode structures', 'Topic research', 'Show notes & outlines'].map(f => (
                        <div key={f} className="flex items-center gap-2 text-[11px] text-[#4a4a6a]">
                          <div className="w-1 h-1 rounded-full bg-purple-500/60" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Voice status */}
          {isHostMode && (
            <div className="px-4 py-3 border-t border-[#1a1a28]">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400 animate-pulse' : isProcessing ? 'bg-yellow-400 animate-pulse' : isPlaying ? 'bg-pink-400 animate-pulse' : 'bg-[#2a2a3a]'}`} />
                <span className="text-[11px] text-[#6b6b8a]">
                  {isRecording ? 'Recording…' : isProcessing ? 'Processing…' : isPlaying ? 'Speaking…' : 'Ready'}
                </span>
              </div>
            </div>
          )}

          {/* Session info + reset */}
          <div className="p-4 border-t border-[#1a1a28]">
            <p className="text-[10px] text-[#3a3a50] truncate mb-2">
              Session: {sessionId ? `${sessionId.slice(0, 12)}…` : 'initializing…'}
            </p>
            <button
              onClick={reset}
              className="w-full text-[11px] text-[#4a4a6a] hover:text-[#e2e2f0] py-1.5 rounded-lg
                border border-[#1a1a28] hover:border-[#252535] transition-all"
            >
              New Conversation
            </button>
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a28] flex-shrink-0">
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-lg">{isHostMode ? '🎙️' : '✍️'}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-[#e2e2f0]">
                      {isHostMode ? 'Live Podcast · ARIA Hosting' : 'Podcast Studio · Creator Mode'}
                    </h2>
                    <p className="text-[11px]" style={{ color: accentColor }}>
                      {isHostMode ? 'Voice-enabled conversation' : 'Script & content generation'}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Streaming toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseStream(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border
                  transition-all duration-150
                  ${useStream
                    ? 'border-purple-800/60 text-purple-400 bg-purple-950/20'
                    : 'border-[#252535] text-[#6b6b8a] hover:text-[#e2e2f0]'
                  }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${useStream ? 'bg-purple-400 animate-pulse' : 'bg-[#4a4a6a]'}`} />
                {useStream ? 'Streaming' : 'Instant'}
              </button>
            </div>
          </header>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto">
            <ChatWindow messages={messages} isLoading={isLoading} mode={mode} />
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {voiceError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mx-4 mb-2 px-4 py-2 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 text-xs"
              >
                ⚠️ {voiceError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input area */}
          <div className="border-t border-[#1a1a28] px-4 py-4 flex-shrink-0">
            <div className={`flex items-end gap-2 bg-[#111118] border rounded-2xl px-4 py-3
              transition-all duration-200
              ${isLoading || isRecording
                ? `border-[${accentColor}]/40 shadow-lg`
                : 'border-[#252535] focus-within:border-[#353550]'
              }`}
            >
              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isRecording}
                placeholder={
                  isRecording
                    ? 'Listening…'
                    : isHostMode
                    ? "Talk to ARIA… (or use the mic 🎤)"
                    : "Ask ARIA to create a script, plan an episode, research a topic…"
                }
                rows={1}
                className="flex-1 bg-transparent text-sm text-[#e2e2f0] placeholder-[#3a3a52] resize-none
                  outline-none min-h-[24px] max-h-32 leading-relaxed"
                style={{ overflow: 'hidden' }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                }}
              />

              {/* Mic button (host mode) */}
              {isHostMode && (
                <MicButton
                  isRecording={isRecording}
                  isProcessing={isProcessing}
                  onClick={toggleRecording}
                  disabled={isLoading || !sessionId}
                />
              )}

              {/* Send button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleSend}
                disabled={!sessionId || !input.trim() || isLoading || isRecording}
                className={`
                  flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                  transition-all duration-200
                  ${input.trim() && !isLoading && !isRecording
                    ? `${accentBg} ${accentHover} shadow-lg`
                    : 'bg-[#1a1a28] opacity-40 cursor-not-allowed'
                  }
                `}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
                  </svg>
                )}
              </motion.button>
            </div>

            <p className="text-[10px] text-[#2a2a3a] mt-2 text-center">
              ARIA · {isHostMode ? 'Host Mode' : 'Creator Mode'} ·{' '}
              <span className="text-[#3a3a52]">Enter to send · Shift+Enter for new line</span>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
