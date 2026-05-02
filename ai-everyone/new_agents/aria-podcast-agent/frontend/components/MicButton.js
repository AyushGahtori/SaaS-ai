import { motion, AnimatePresence } from 'framer-motion';

export default function MicButton({ isRecording, isProcessing, onClick, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={disabled || isProcessing}
      title={isRecording ? 'Stop recording' : 'Start recording'}
      className={`
        relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
        transition-all duration-200
        ${isRecording
          ? 'bg-[#ec4899] mic-pulse'
          : isProcessing
          ? 'bg-[#6b21a8] opacity-70'
          : 'bg-[#252535] hover:bg-[#2e2e42] text-[#e2e2f0]'
        }
        ${(disabled || isProcessing) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
      `}
    >
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
          />
        ) : isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="w-3 h-3 bg-white rounded-sm"
          />
        ) : (
          <motion.svg
            key="mic"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-[#e2e2f0]"
          >
            <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2a1 1 0 0 1 2 0v2a5 5 0 0 0 10 0v-2a1 1 0 0 1 2 0Z" />
            <path d="M12 19v3M9 22h6" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
