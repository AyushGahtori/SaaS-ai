import { useState } from 'react';
import { motion } from 'framer-motion';
import { playTTS } from '../services/api';

export default function AudioPlayer({ text, mode, autoPlay = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioRef, setAudioRef] = useState(null);

  const togglePlay = async () => {
    if (isPlaying && audioRef) {
      audioRef.pause();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      const audio = await playTTS(text);
      if (audio) {
        setAudioRef(audio);
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => {
          setIsPlaying(false);
          setIsLoading(false);
        };
      }
    } catch (err) {
      console.error('Playback failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const accentColor = mode === 'host' ? '#ec4899' : '#7c3aed';

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={togglePlay}
      disabled={isLoading}
      title={isPlaying ? 'Stop' : 'Listen'}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
        bg-[#1a1a28] border border-[#252535] hover:border-[#353550]
        transition-all duration-150"
      style={{ color: accentColor }}
    >
      {isLoading ? (
        <>
          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading…</span>
        </>
      ) : isPlaying ? (
        <>
          <div className="flex items-end gap-[2px] h-3.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="audio-bar w-[2px]" style={{ background: accentColor }} />
            ))}
          </div>
          <span>Stop</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
          </svg>
          <span>Listen</span>
        </>
      )}
    </motion.button>
  );
}
