'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { subscribeToTask } from '@/lib/firestore-tasks'
import { useChatContext } from '@/modules/chat/context/chat-context'

// ── Types ────────────────────────────────────────────────────────────────────

type VoiceBarState = 'connecting' | 'listening' | 'thinking' | 'speaking'

interface VoiceBarProps {
  onSendMessage: (text: string, isVoice: boolean) => Promise<{ type: string; content?: string; taskId?: string } | undefined>
  onClose: () => void
  onFirstMessage?: () => void
}

// ── CSS-animated waveform ────────────────────────────────────────────────────
// Matches old VoiceModal's fake CSS bars. No getUserMedia, no mic lock.

function WaveformBars({ active }: { active: boolean }) {
  const heights = [16, 26, 36, 46, 54, 46, 36, 26, 36, 46, 36, 26, 16]
  if (!active) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 32 }}>
        {heights.map((_, i) => (
          <div key={i} style={{ width: 2, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
        ))}
      </div>
    )
  }
  return (
    <>
      <style>{`
        @keyframes vbBar {
          from { transform: scaleY(0.25); opacity: 0.55; }
          to   { transform: scaleY(1.0);  opacity: 1.0;  }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 32, width: '100%', padding: '0 8px' }}>
        {heights.map((h, i) => (
          <div key={i} style={{
            width: 2.5, height: h * 0.6, borderRadius: 2, background: 'rgba(255,255,255,0.85)',
            transformOrigin: 'center center',
            animation: `vbBar ${0.5 + (i % 5) * 0.12}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.06}s`,
          }} />
        ))}
      </div>
    </>
  )
}

// ── Close intent ────────────────────────────────────────────────────────────

const CLOSE_INTENT = /\b(close|close voice|close assistant|stop listening|exit|goodbye|that'?s? all|finish|end session|quit)\b/i

// ─────────────────────────────────────────────────────────────────────────────
// VOICEBAR COMPONENT
//
// Root cause of prior failures: React Strict Mode double-mounts the component
// in dev. The first SpeechRecognition is aborted, and its async onend callback
// fires AFTER the second one starts, causing an infinite restart loop where
// recognition keeps aborting itself. Fix: use a recognition generation counter
// so stale onend/onerror callbacks are ignored, and delay the initial start.
// ─────────────────────────────────────────────────────────────────────────────

export default function VoiceBar({ onSendMessage, onClose, onFirstMessage }: VoiceBarProps) {
  const [state, setState] = useState<VoiceBarState>('connecting')
  const [statusText, setStatusText] = useState('Starting…')
  const [debugText, setDebugText] = useState('')  // visible debug

  // Access context for pending voice response (survives remount)
  const { pendingVoiceResponse, setPendingVoiceResponse } = useChatContext()

  // Refs
  const recognitionRef = useRef<any>(null)
  const isSpeakingRef = useRef(false)
  const isClosingRef = useRef(false)
  const interimTextRef = useRef('')
  const mountedRef = useRef(true)
  const genRef = useRef(0) // recognition generation counter — fixes strict mode

  // Stable refs for props
  const onSendMessageRef = useRef(onSendMessage)
  const onCloseRef = useRef(onClose)
  const onFirstMessageRef = useRef(onFirstMessage)
  useEffect(() => { onSendMessageRef.current = onSendMessage }, [onSendMessage])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { onFirstMessageRef.current = onFirstMessage }, [onFirstMessage])

  // ── Helpers ────────────────────────────────────────────────────────────

  const pickVoice = () => {
    const all = speechSynthesis.getVoices()
    return (
      all.find(v => v.name.includes('Google UK English Female')) ||
      all.find(v => v.name.includes('Google')) ||
      all.find(v => v.name.includes('Microsoft')) ||
      all[0]
    )
  }

  const hardClose = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    mountedRef.current = false
    genRef.current++ // invalidate any pending callbacks
    try { recognitionRef.current?.abort() } catch {}
    speechSynthesis.cancel()
    onCloseRef.current()
  }

  // ── Speak response then re-listen ─────────────────────────────────────
  // Identical to old VoiceModal.speakResponse

  const speakResponse = (text: string) => {
    if (!mountedRef.current || isClosingRef.current) return
    isSpeakingRef.current = true
    setState('speaking')
    setStatusText('Speaking…')
    setDebugText('TTS: ' + text.slice(0, 60))
    try { recognitionRef.current?.abort() } catch {}
    speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    const v = pickVoice(); if (v) utter.voice = v
    utter.rate = 0.95; utter.pitch = 1.05; utter.volume = 1

    utter.onend = () => {
      if (!mountedRef.current || isClosingRef.current) return
      isSpeakingRef.current = false
      setTimeout(() => { if (mountedRef.current && !isClosingRef.current) startListening() }, 500)
    }
    utter.onerror = () => {
      isSpeakingRef.current = false
      if (mountedRef.current && !isClosingRef.current) setTimeout(startListening, 500)
    }
    speechSynthesis.speak(utter)
  }

  // ── Listen loop ───────────────────────────────────────────────────────
  // Same as old VoiceModal.startListening, plus generation counter.

  const startListeningRef = useRef<() => void>(() => {})

  const startListening = () => {
    if (!mountedRef.current || isClosingRef.current || isSpeakingRef.current) return
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      setTimeout(() => { if (mountedRef.current) startListening() }, 300)
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setDebugText('ERROR: SpeechRecognition API not available')
      return
    }

    try { recognitionRef.current?.abort() } catch {}

    // Increment generation — any callbacks from older generations will be ignored
    const myGen = ++genRef.current

    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = true
    recognitionRef.current = rec

    rec.onstart = () => {
      if (genRef.current !== myGen) return // stale
      if (!mountedRef.current || isSpeakingRef.current) { try { rec.abort() } catch {}; return }
      interimTextRef.current = ''
      setState('listening')
      setStatusText('Listening…')
      setDebugText('rec.onstart ✓ (gen ' + myGen + ')')
    }

    rec.onresult = (e: any) => {
      if (genRef.current !== myGen) return // stale
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript
        if (e.results[i].isFinal) interimTextRef.current = text
      }
      setDebugText('heard: "' + text + '"')
    }

    rec.onerror = (e: any) => {
      if (genRef.current !== myGen) return // stale
      setDebugText('rec.onerror: ' + e.error)
      if (e.error === 'aborted') return
      setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current && !isSpeakingRef.current) startListening()
      }, 600)
    }

    rec.onend = () => {
      // ★ KEY FIX: ignore callbacks from older recognition instances
      if (genRef.current !== myGen) {
        setDebugText('rec.onend IGNORED (stale gen ' + myGen + ', cur ' + genRef.current + ')')
        return
      }

      if (!mountedRef.current || isClosingRef.current) return

      const said = interimTextRef.current.trim()
      interimTextRef.current = ''

      setDebugText('rec.onend — said: "' + said + '"')

      if (!said) {
        if (!isSpeakingRef.current) setTimeout(() => { if (mountedRef.current) startListening() }, 200)
        return
      }

      // Close intent
      if (CLOSE_INTENT.test(said)) {
        hardClose()
        return
      }

      if (isSpeakingRef.current) return

      // ── Process ────────────────────────────────────────────────
      setState('thinking')
      setStatusText('Processing…')
      setDebugText('Sending to LLM: "' + said + '"')

      onFirstMessageRef.current?.()

      onSendMessageRef.current(said, true).then((responseData) => {
        // If this VoiceBar instance was unmounted (e.g. HomeView→ChatView
        // transition during first message), save response to context so
        // the NEW VoiceBar instance can pick it up and speak it.
        if (!mountedRef.current || isClosingRef.current) {
          if (responseData) {
            let textToSpeak = ''
            if (responseData.type === 'agent_task') {
              textToSpeak = 'Task has been submitted. Please wait.'
            } else {
              textToSpeak = responseData.content || "I'm not sure what to say."
            }
            setPendingVoiceResponse(textToSpeak)
          }
          return
        }

        if (!responseData) {
          speakResponse('Sorry, I could not process that.')
          return
        }

        if (responseData.type === 'agent_task') {
          const taskId = responseData.taskId as string
          setStatusText('Agent working…')
          setDebugText('Agent task: ' + taskId)

          const unsub = subscribeToTask(taskId, (task) => {
            if (!task) return
            if (task.status === 'success') {
              unsub()
              const msg = (task.agentOutput?.message || 'I have completed the task.') as string
              speakResponse(msg)
            } else if (task.status === 'failed') {
              unsub()
              speakResponse('Sorry, I encountered an error.')
            }
          })
        } else {
          speakResponse(responseData.content || "I'm not sure what to say.")
        }
      }).catch((err) => {
        setDebugText('ERROR: ' + String(err))
        if (mountedRef.current) speakResponse('Sorry, there was a connection problem.')
      })
    }

    rec.start()
    setDebugText('rec.start() called (gen ' + myGen + ')')
  }

  startListeningRef.current = startListening

  // ── Focus/visibility restart ──────────────────────────────────────────

  useEffect(() => {
    const onReturn = () => {
      if (!mountedRef.current || isClosingRef.current || isSpeakingRef.current) return
      try { recognitionRef.current?.abort() } catch {}
      setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current && !isSpeakingRef.current) {
          startListeningRef.current()
        }
      }, 400)
    }
    const onVis = () => { if (document.visibilityState === 'visible') onReturn() }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────
  // ★ KEY FIX: delay start by 800ms so React Strict Mode's double-mount
  //   is fully complete before we create the first SpeechRecognition.

  useEffect(() => {
    mountedRef.current = true
    isClosingRef.current = false
    isSpeakingRef.current = false
    genRef.current = 0

    speechSynthesis.getVoices()

    const timer = setTimeout(() => {
      if (mountedRef.current && !isClosingRef.current) {
        setDebugText('Init: starting recognition after delay')
        startListeningRef.current()
      }
    }, 800)

    return () => {
      mountedRef.current = false
      isClosingRef.current = true
      genRef.current++ // invalidate all pending callbacks
      clearTimeout(timer)
      try { recognitionRef.current?.abort() } catch {}
      speechSynthesis.cancel()
    }
  }, [])

  // ── Pick up pending voice response from a prior VoiceBar instance ─────
  // Handles: first message from homepage creates new chat, HomeView→ChatView
  // transition unmounts old VoiceBar mid-response. Response is saved in context.
  useEffect(() => {
    if (pendingVoiceResponse && mountedRef.current && !isClosingRef.current) {
      const t = setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current) {
          speakResponse(pendingVoiceResponse)
          setPendingVoiceResponse(null)
        }
      }, 400)
      return () => clearTimeout(t)
    }
  }, [pendingVoiceResponse])

  // ── Render ────────────────────────────────────────────────────────────

  const stateColor =
    state === 'listening' ? '#4ade80'
    : state === 'thinking' ? '#fb923c'
    : state === 'speaking' ? '#38bdf8'
    : '#94a3b8'

  return (
    <div
      className="flex flex-col items-center gap-1 rounded-2xl border border-white/5 px-4 py-2.5"
      style={{
        backgroundColor: '#0C0D0D',
        minHeight: 48,
        maxWidth: 420,
        width: '100%',
        margin: '0 auto',
      }}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Status dot */}
        <div
          className="shrink-0 rounded-full"
          style={{
            width: 8, height: 8,
            backgroundColor: stateColor,
            boxShadow: `0 0 8px ${stateColor}`,
            animation: state === 'thinking' ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
        />

        {/* Waveform + Status */}
        <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
          <WaveformBars active={state === 'listening'} />
          <span className="text-[11px] font-medium tracking-wide" style={{ color: stateColor }}>
            {statusText}
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={hardClose}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors bg-white/5 hover:bg-white/15"
          aria-label="Close voice input"
        >
          <X className="w-3.5 h-3.5 text-white/60" />
        </button>
      </div>

      {/* Debug info — visible on screen so we can diagnose */}
      {debugText && (
        <div className="w-full text-center text-[9px] text-white/30 font-mono truncate mt-0.5">
          {debugText}
        </div>
      )}
    </div>
  )
}
