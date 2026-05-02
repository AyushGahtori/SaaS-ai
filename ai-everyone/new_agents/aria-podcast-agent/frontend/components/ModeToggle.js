import { motion } from 'framer-motion';

export default function ModeToggle({ mode, onSwitch, disabled }) {
  return (
    <div className="flex items-center gap-1 bg-[#111118] border border-[#252535] rounded-xl p-1">
      <ModeButton
        label="🎙️ Host"
        value="host"
        active={mode === 'host'}
        onClick={() => onSwitch('host')}
        disabled={disabled}
        activeClass="bg-[#ec4899] text-white shadow-lg shadow-pink-900/30"
      />
      <ModeButton
        label="✍️ Creator"
        value="creator"
        active={mode === 'creator'}
        onClick={() => onSwitch('creator')}
        disabled={disabled}
        activeClass="bg-[#7c3aed] text-white shadow-lg shadow-purple-900/30"
      />
    </div>
  );
}

function ModeButton({ label, value, active, onClick, disabled, activeClass }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
        ${active
          ? activeClass
          : 'text-[#6b6b8a] hover:text-[#e2e2f0] hover:bg-[#1a1a25]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {label}
      {active && (
        <motion.div
          layoutId="mode-indicator"
          className="absolute inset-0 rounded-lg -z-10"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
}
