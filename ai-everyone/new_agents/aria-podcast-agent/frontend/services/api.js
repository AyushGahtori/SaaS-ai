import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

// ── Chat ──────────────────────────────────────

export async function sendMessage({ message, sessionId, mode, stream = false }) {
  const res = await api.post('/api/chat/', {
    message,
    session_id: sessionId,
    mode,
    stream,
  });
  return res.data;
}

export async function streamMessage({ message, sessionId, mode, onToken, onDone }) {
  const response = await fetch(`${API_URL}/api/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId, mode, stream: true }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const token = line.slice(6);
        if (token === '[DONE]') {
          onDone?.(fullText);
          return;
        }
        fullText += token;
        onToken?.(token, fullText);
      }
    }
  }
  onDone?.(fullText);
}

export async function setMode(sessionId, mode) {
  const res = await api.post('/api/chat/mode', { session_id: sessionId, mode });
  return res.data;
}

export async function getWelcome(sessionId, mode) {
  const res = await api.post('/api/chat/welcome', { session_id: sessionId, mode });
  return res.data;
}

export async function getHistory(sessionId) {
  const res = await api.get(`/api/chat/history/${sessionId}`);
  return res.data;
}

export async function clearHistory(sessionId) {
  const res = await api.delete(`/api/chat/history/${sessionId}`);
  return res.data;
}

// ── Voice ────────────────────────────────────

export async function sendVoiceInput({ audioBlob, sessionId, mode }) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  if (sessionId) formData.append('session_id', sessionId);
  if (mode) formData.append('mode', mode);

  const res = await api.post('/api/voice/input', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return res.data;
}

// ── TTS ──────────────────────────────────────

export async function getTTS(text) {
  const res = await api.post(
    '/api/tts/',
    { text },
    { responseType: 'arraybuffer' }
  );
  return res.data;
}

export async function playTTS(text) {
  try {
    const arrayBuffer = await getTTS(text);
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return audio;
  } catch (err) {
    console.error('TTS playback failed:', err);
    return null;
  }
}

// ── Health ───────────────────────────────────

export async function getHealth() {
  const res = await api.get('/health');
  return res.data;
}

export default api;
