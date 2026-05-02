import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendMessage, streamMessage, getWelcome, clearHistory } from '../services/api';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [mode, setModeState] = useState('creator');
  const abortRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('aria_session_id');
    if (stored) {
      setSessionId(stored);
      return;
    }
    const id = uuidv4();
    localStorage.setItem('aria_session_id', id);
    setSessionId(id);
  }, []);

  const addMessage = useCallback((role, content, extra = {}) => {
    const msg = { id: uuidv4(), role, content, ts: Date.now(), ...extra };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const updateLastAssistantMessage = useCallback((content) => {
    setMessages(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') {
          copy[i] = { ...copy[i], content };
          return copy;
        }
      }
      return copy;
    });
  }, []);

  const sendChatMessage = useCallback(async (text, useStream = true) => {
    if (!sessionId || !text.trim() || isLoading) return;

    addMessage('user', text);
    setIsLoading(true);

    if (useStream) {
      // Add placeholder
      const placeholder = { id: uuidv4(), role: 'assistant', content: '', ts: Date.now(), streaming: true };
      setMessages(prev => [...prev, placeholder]);

      try {
        await streamMessage({
          message: text,
          sessionId,
          mode,
          onToken: (token, fullText) => {
            setMessages(prev => {
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              if (copy[lastIdx]?.streaming) {
                copy[lastIdx] = { ...copy[lastIdx], content: fullText };
              }
              return copy;
            });
          },
          onDone: (fullText) => {
            setMessages(prev => {
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              if (copy[lastIdx]?.streaming) {
                copy[lastIdx] = { ...copy[lastIdx], content: fullText, streaming: false };
              }
              return copy;
            });
            setIsLoading(false);
          },
        });
      } catch (err) {
        console.error('Stream error:', err);
        setMessages(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (copy[lastIdx]?.streaming) {
            copy[lastIdx] = { ...copy[lastIdx], content: 'Something went wrong. Please try again.', streaming: false };
          }
          return copy;
        });
        setIsLoading(false);
      }
    } else {
      try {
        const data = await sendMessage({ message: text, sessionId, mode });
        addMessage('assistant', data.response);
      } catch (err) {
        console.error('Chat error:', err);
        addMessage('assistant', 'Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [isLoading, sessionId, mode, addMessage]);

  const switchMode = useCallback(async (newMode) => {
    setModeState(newMode);
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const data = await getWelcome(sessionId, newMode);
      addMessage('assistant', data.message, { isWelcome: true });
    } catch (err) {
      console.error('Mode switch error:', err);
      const welcomeText = newMode === 'host'
        ? "Hey — welcome to the show! I'm ARIA. What do you want to talk about today?"
        : "Hey! I'm ARIA, your podcast production partner. What are we creating today?";
      addMessage('assistant', welcomeText, { isWelcome: true });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, addMessage]);

  const addVoiceResult = useCallback(({ transcript, response }) => {
    if (transcript) addMessage('user', transcript, { fromVoice: true });
    if (response) addMessage('assistant', response, { fromVoice: true });
  }, [addMessage]);

  const reset = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    try {
      await clearHistory(sessionId);
    } catch {}
    setMessages([]);
  }, [sessionId]);

  return {
    messages,
    isLoading,
    sessionId,
    mode,
    sendChatMessage,
    switchMode,
    addVoiceResult,
    reset,
  };
}
