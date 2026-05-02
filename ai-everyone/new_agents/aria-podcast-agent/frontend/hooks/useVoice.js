import { useState, useRef, useCallback } from 'react';
import { sendVoiceInput, playTTS } from '../services/api';

export function useVoice({ sessionId, mode, onResult }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const currentAudioRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          setIsProcessing(false);
          return;
        }
        await processVoice(blob);
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      setError('Microphone access denied. Please allow mic permissions.');
    }
  }, [sessionId, mode]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  }, [isRecording]);

  const processVoice = useCallback(async (audioBlob) => {
    try {
      const data = await sendVoiceInput({ audioBlob, sessionId, mode });
      onResult?.(data);

      // Auto-play TTS response in host mode
      if (mode === 'host' && data.response) {
        await speakText(data.response);
      }
    } catch (err) {
      console.error('Voice processing error:', err);
      setError('Voice processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, mode, onResult]);

  const speakText = useCallback(async (text) => {
    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setIsPlaying(true);
    try {
      const audio = await playTTS(text);
      if (audio) {
        currentAudioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlaying(false);
          currentAudioRef.current = null;
        };
      } else {
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('TTS error:', err);
      setIsPlaying(false);
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isProcessing,
    isPlaying,
    error,
    toggleRecording,
    startRecording,
    stopRecording,
    speakText,
    stopAudio,
  };
}
