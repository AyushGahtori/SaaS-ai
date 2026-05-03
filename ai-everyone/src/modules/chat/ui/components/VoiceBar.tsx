'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { subscribeToTask } from '@/lib/firestore-tasks'
import { useChatContext } from '@/modules/chat/context/chat-context'

type VoiceBarState = 'connecting' | 'listening' | 'thinking' | 'speaking'

interface VoiceBarProps {
  onSendMessage: (
    text: string,
    isVoice: boolean
  ) => Promise<{
    type: string
    content?: string
    taskId?: string
    audioBase64?: string
    audioMimeType?: string
    meta?: Record<string, unknown>
  } | undefined>
  onClose: () => void
  onFirstMessage?: () => void
}

function WaveformBars({ state }: { state: VoiceBarState }) {
  const bars = [58, 34, 46, 28, 60, 64, 40, 52, 66, 48, 36, 30, 62, 68, 44, 56, 42, 32, 60, 66, 46, 54, 38, 28, 58, 62, 40, 50, 34, 60]
  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'
  const isThinking = state === 'thinking'
  const isActive = isListening || isSpeaking

  return (
    <>
      <style>{`
        @keyframes vb-wave-listen {
          0% { transform: scaleY(0.55); opacity: 0.52; }
          100% { transform: scaleY(1); opacity: 1; }
        }

        @keyframes vb-wave-speak {
          0% { transform: scaleY(0.45); opacity: 0.5; }
          100% { transform: scaleY(0.92); opacity: 0.95; }
        }

        @keyframes vb-wave-think {
          0%, 100% { opacity: 0.36; }
          50% { opacity: 0.86; }
        }
      `}</style>

      <div className="flex h-10 w-full items-center justify-center gap-[5px] px-1.5 sm:gap-[6px]">
        {bars.map((height, index) => (
          <span
            key={index}
            className="rounded-full"
            style={{
              width: 4,
              height: Math.round(height * 0.34),
              background: isActive ? 'rgb(239 242 248 / 94%)' : 'rgb(239 242 248 / 30%)',
              boxShadow: isActive ? '0 0 7px rgb(255 255 255 / 10%)' : 'none',
              transformOrigin: 'center',
              animation: isListening
                ? `vb-wave-listen ${0.48 + (index % 6) * 0.08}s cubic-bezier(0.22, 1, 0.36, 1) infinite alternate`
                : isSpeaking
                ? `vb-wave-speak ${0.5 + (index % 5) * 0.09}s ease-in-out infinite alternate`
                : isThinking
                ? `vb-wave-think ${1 + (index % 4) * 0.18}s ease-in-out infinite`
                : 'none',
              animationDelay: `${index * 0.03}s`,
            }}
          />
        ))}
      </div>
    </>
  )
}

const CLOSE_INTENT = /\b(close|close voice|close assistant|stop listening|exit|goodbye|that'?s? all|finish|end session|quit)\b/i
const FINAL_TRANSCRIPT_GRACE_MS = 1700

function getPreferredRecognitionLanguage() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  if (/Asia\/(Kolkata|Calcutta)/i.test(timezone)) return 'en-IN'

  const preferredEnglish = (navigator.languages || [navigator.language])
    .find((language) => /^en-(IN|US|GB|AU|CA)\b/i.test(language))
  return preferredEnglish || 'en-US'
}

export default function VoiceBar({ onSendMessage, onClose, onFirstMessage }: VoiceBarProps) {
  const [state, setState] = useState<VoiceBarState>('connecting')
  const [statusText, setStatusText] = useState('Starting...')

  const { activeChatId, pendingVoiceResponse, setPendingVoiceResponse, setLiveVoiceTranscript } = useChatContext()

  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextAudioTimeRef = useRef(0)
  const playbackFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heardStreamAudioRef = useRef(false)
  const streamedVoiceTurnRef = useRef(false)
  const lastStreamAudioAtRef = useRef(0)
  const isSpeakingRef = useRef(false)
  const isClosingRef = useRef(false)
  const interimTextRef = useRef('')
  const submittedTranscriptRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const genRef = useRef(0)
  const activeChatIdRef = useRef(activeChatId)
  const startListeningRef = useRef<() => void>(() => {})
  const playRawAudioChunkRef = useRef<(audioBase64: string, mimeType?: string) => void>(() => {})
  const speakResponseRef = useRef<(text: string, audioBase64?: string, audioMimeType?: string) => void>(() => {})

  const onSendMessageRef = useRef(onSendMessage)
  const onCloseRef = useRef(onClose)
  const onFirstMessageRef = useRef(onFirstMessage)

  useEffect(() => {
    onSendMessageRef.current = onSendMessage
  }, [onSendMessage])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    onFirstMessageRef.current = onFirstMessage
  }, [onFirstMessage])

  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  const pickVoice = () => {
    const all = speechSynthesis.getVoices()
    return (
      all.find((v) => v.name.includes('Google UK English Female')) ||
      all.find((v) => v.name.includes('Google')) ||
      all.find((v) => v.name.includes('Microsoft')) ||
      all[0]
    )
  }

  const restartListeningAfterSpeech = () => {
    if (!mountedRef.current || isClosingRef.current) return
    isSpeakingRef.current = false
    setLiveVoiceTranscript('')
    setTimeout(() => {
      if (mountedRef.current && !isClosingRef.current) startListening()
    }, 500)
  }

  const stopQueuedAudio = () => {
    if (finalTranscriptStopTimerRef.current) {
      clearTimeout(finalTranscriptStopTimerRef.current)
      finalTranscriptStopTimerRef.current = null
    }
    if (playbackFinishTimerRef.current) {
      clearTimeout(playbackFinishTimerRef.current)
      playbackFinishTimerRef.current = null
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }
    for (const source of audioSourcesRef.current) {
      try {
        source.stop()
      } catch {}
    }
    audioSourcesRef.current = []
    nextAudioTimeRef.current = 0
  }

  const scheduleListeningAfterStream = () => {
    if (playbackFinishTimerRef.current) {
      clearTimeout(playbackFinishTimerRef.current)
      playbackFinishTimerRef.current = null
    }

    const ctx = audioContextRef.current
    const delayMs = ctx
      ? Math.max(450, Math.ceil((nextAudioTimeRef.current - ctx.currentTime + 0.35) * 1000))
      : 800

    playbackFinishTimerRef.current = setTimeout(() => {
      playbackFinishTimerRef.current = null
      if (!mountedRef.current || isClosingRef.current) return

      heardStreamAudioRef.current = false
      streamedVoiceTurnRef.current = false
      isSpeakingRef.current = false
      audioSourcesRef.current = []

      startListeningRef.current()
    }, delayMs)
  }

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioCtx()
    }
    return audioContextRef.current
  }

  const parseRawAudioMimeType = (mimeType = '') => {
    const options = { sampleRate: 24000, bitsPerSample: 16, channels: 1 }
    const [fileType, ...params] = mimeType.split(';').map((item) => item.trim())
    const [, format] = fileType.split('/')

    if (format?.startsWith('L')) {
      const bits = Number.parseInt(format.slice(1), 10)
      if (Number.isFinite(bits)) options.bitsPerSample = bits
    }

    for (const param of params) {
      const [key, value] = param.split('=').map((item) => item.trim())
      if (key === 'rate') {
        const sampleRate = Number.parseInt(value, 10)
        if (Number.isFinite(sampleRate)) options.sampleRate = sampleRate
      }
    }

    return options
  }

  const decodeBase64Bytes = (base64: string) => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  const playRawAudioChunk = (audioBase64: string, mimeType = '') => {
    if (!mountedRef.current || isClosingRef.current || !audioBase64) return

    const { sampleRate, bitsPerSample, channels } = parseRawAudioMimeType(mimeType)
    if (bitsPerSample !== 16 || channels !== 1) return

    isSpeakingRef.current = true
    heardStreamAudioRef.current = true
    streamedVoiceTurnRef.current = true
    lastStreamAudioAtRef.current = Date.now()
    setState('speaking')
    setStatusText('Speaking...')

    try {
      recognitionRef.current?.abort()
    } catch {}
    speechSynthesis.cancel()

    const ctx = getAudioContext()
    void ctx.resume().catch(() => {})

    const bytes = decodeBase64Bytes(audioBase64)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const frameCount = Math.floor(bytes.byteLength / 2)
    const buffer = ctx.createBuffer(1, frameCount, sampleRate)
    const channel = buffer.getChannelData(0)

    for (let i = 0; i < frameCount; i++) {
      channel[i] = Math.max(-1, Math.min(1, view.getInt16(i * 2, true) / 32768))
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => {
      audioSourcesRef.current = audioSourcesRef.current.filter((item) => item !== source)
    }

    const startAt = Math.max(ctx.currentTime + 0.03, nextAudioTimeRef.current || 0)
    source.start(startAt)
    nextAudioTimeRef.current = startAt + buffer.duration
    audioSourcesRef.current.push(source)
    scheduleListeningAfterStream()
  }

  const finishStreamingPlayback = () => {
    scheduleListeningAfterStream()
  }

  const playAudioBase64 = (audioBase64: string, mimeType = 'audio/wav') => {
    const bytes = decodeBase64Bytes(audioBase64)

    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
    const audio = new Audio(url)
    currentAudioRef.current = audio
    currentAudioUrlRef.current = url
    const cleanup = () => {
      if (currentAudioRef.current === audio) currentAudioRef.current = null
      if (currentAudioUrlRef.current === url) currentAudioUrlRef.current = null
      URL.revokeObjectURL(url)
    }
    audio.onended = () => {
      cleanup()
      restartListeningAfterSpeech()
    }
    audio.onerror = () => {
      cleanup()
      restartListeningAfterSpeech()
    }
    void audio.play().catch(() => {
      cleanup()
      restartListeningAfterSpeech()
    })
  }

  const hardClose = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    mountedRef.current = false
    genRef.current++
    try {
      recognitionRef.current?.abort()
    } catch {}
    stopQueuedAudio()
    speechSynthesis.cancel()
    setLiveVoiceTranscript('')
    onCloseRef.current()
  }

  const speakResponse = (text: string, audioBase64?: string, audioMimeType?: string) => {
    if (!mountedRef.current || isClosingRef.current) return
    if (!audioBase64 && streamedVoiceTurnRef.current) return
    if (!audioBase64 && Date.now() - lastStreamAudioAtRef.current < 15000) return

    isSpeakingRef.current = true
    setState('speaking')
    setStatusText('Speaking...')

    try {
      recognitionRef.current?.abort()
    } catch {}

    stopQueuedAudio()
    speechSynthesis.cancel()

    if (audioBase64) {
      playAudioBase64(audioBase64, audioMimeType)
      return
    }

    const utter = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) utter.voice = voice

    utter.rate = 0.95
    utter.pitch = 1.05
    utter.volume = 1

    let keepAliveTimer: ReturnType<typeof setInterval> | null = null
    const clearKeepAlive = () => {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer)
        keepAliveTimer = null
      }
    }

    utter.onstart = () => {
      clearKeepAlive()
      keepAliveTimer = setInterval(() => {
        if (!mountedRef.current || isClosingRef.current) {
          clearKeepAlive()
          return
        }
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
          speechSynthesis.pause()
          speechSynthesis.resume()
        }
      }, 7000)
    }

    utter.onend = () => {
      clearKeepAlive()
      restartListeningAfterSpeech()
    }

    utter.onerror = () => {
      clearKeepAlive()
      restartListeningAfterSpeech()
    }

    speechSynthesis.speak(utter)
  }

  playRawAudioChunkRef.current = playRawAudioChunk
  speakResponseRef.current = speakResponse

  const startListening = () => {
    if (!mountedRef.current || isClosingRef.current || isSpeakingRef.current) return

    if (speechSynthesis.speaking || speechSynthesis.pending) {
      setTimeout(() => {
        if (mountedRef.current) startListening()
      }, 300)
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setStatusText('Voice not supported in this browser')
      return
    }

    try {
      recognitionRef.current?.abort()
    } catch {}

    const myGen = ++genRef.current
    submittedTranscriptRef.current = false

    const rec = new SR()
    rec.lang = getPreferredRecognitionLanguage()
    rec.continuous = true
    rec.interimResults = true
    recognitionRef.current = rec

    rec.onstart = () => {
      if (genRef.current !== myGen) return
      if (!mountedRef.current || isSpeakingRef.current) {
        try {
          rec.abort()
        } catch {}
        return
      }

      interimTextRef.current = ''
      setLiveVoiceTranscript('')
      setState('listening')
      setStatusText('Listening...')
    }

    rec.onresult = (event: any) => {
      if (genRef.current !== myGen) return
      if (finalTranscriptStopTimerRef.current) {
        clearTimeout(finalTranscriptStopTimerRef.current)
        finalTranscriptStopTimerRef.current = null
      }

      let fullTranscript = ''
      let finalTranscript = ''
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || ''
        fullTranscript += transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        }
      }

      const currentTranscript = (finalTranscript || fullTranscript).trim()
      interimTextRef.current = currentTranscript
      setLiveVoiceTranscript(currentTranscript)

      if (finalTranscript.trim() && !submittedTranscriptRef.current) {
        if (finalTranscriptStopTimerRef.current) clearTimeout(finalTranscriptStopTimerRef.current)
        finalTranscriptStopTimerRef.current = setTimeout(() => {
          finalTranscriptStopTimerRef.current = null
          if (genRef.current !== myGen || submittedTranscriptRef.current) return
          try {
            rec.stop()
          } catch {}
        }, FINAL_TRANSCRIPT_GRACE_MS)
      }
    }

    rec.onerror = (event: any) => {
      if (genRef.current !== myGen) return
      if (event.error === 'aborted') return

      setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current && !isSpeakingRef.current) {
          startListening()
        }
      }, 600)
    }

    rec.onend = () => {
      if (genRef.current !== myGen) return
      recognitionRef.current = null
      if (!mountedRef.current || isClosingRef.current) return

      const said = interimTextRef.current.trim()
      interimTextRef.current = ''

      if (!said) {
        setLiveVoiceTranscript('')
        if (!isSpeakingRef.current) {
          setTimeout(() => {
            if (mountedRef.current) startListening()
          }, 200)
        }
        return
      }

      if (CLOSE_INTENT.test(said)) {
        setLiveVoiceTranscript('')
        hardClose()
        return
      }

      if (isSpeakingRef.current) return
      if (submittedTranscriptRef.current) return
      submittedTranscriptRef.current = true

      setState('thinking')
      setStatusText('Processing...')
      heardStreamAudioRef.current = false
      streamedVoiceTurnRef.current = false
      stopQueuedAudio()
      onFirstMessageRef.current?.()

      const voiceRequestStartedAt = Date.now()

      onSendMessageRef.current(said, true)
        .then((responseData) => {
          if (!mountedRef.current || isClosingRef.current) {
            return
          }

          if (!responseData) {
            speakResponse('Sorry, I could not process that.')
            return
          }

          if (responseData.type === 'agent_task') {
            const taskId = responseData.taskId as string
            setStatusText('Agent working...')

            const unsub = subscribeToTask(taskId, (task) => {
              if (!task) return

              const summary =
                (task.agentOutput?.message ||
                  task.agentOutput?.summary ||
                  task.agentOutput?.error ||
                  '') as string

              if (task.status === 'success' || task.status === 'partial_success') {
                unsub()
                speakResponse(summary || 'I have completed the task.')
              } else if (
                task.status === 'failed' ||
                task.status === 'needs_input' ||
                task.status === 'action_required'
              ) {
                unsub()
                speakResponse(summary || 'Sorry, I could not complete that request.')
              }
            })
          } else {
            if (responseData.meta?.voiceAudioStreamed === true) {
              finishStreamingPlayback()
              return
            }

            const streamedDuringThisTurn =
              streamedVoiceTurnRef.current ||
              lastStreamAudioAtRef.current >= voiceRequestStartedAt - 250

            if (heardStreamAudioRef.current || streamedDuringThisTurn) {
              finishStreamingPlayback()
              return
            }
            speakResponse(
              responseData.content || "I'm not sure what to say.",
              responseData.audioBase64,
              responseData.audioMimeType
            )
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            speakResponse('Sorry, there was a connection problem.')
          }
        })
        .finally(() => {
          setLiveVoiceTranscript('')
        })
    }

    rec.start()
  }

  startListeningRef.current = startListening

  useEffect(() => {
    const onAudioDelta = (event: Event) => {
      const detail = (event as CustomEvent<{
        chatId?: string
        audioBase64?: string
        audioMimeType?: string
      }>).detail

      if (!detail?.audioBase64) return
      if (detail.chatId && detail.chatId !== activeChatIdRef.current) return
      playRawAudioChunkRef.current(detail.audioBase64, detail.audioMimeType)
    }

    const onReturn = () => {
      if (!mountedRef.current || isClosingRef.current || isSpeakingRef.current) return

      try {
        recognitionRef.current?.abort()
      } catch {}

      setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current && !isSpeakingRef.current) {
          startListeningRef.current()
        }
      }, 400)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onReturn()
    }

    window.addEventListener('pian:voice-audio-delta', onAudioDelta)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('pian:voice-audio-delta', onAudioDelta)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    isClosingRef.current = false
    isSpeakingRef.current = false
    genRef.current = 0

    speechSynthesis.getVoices()

    const timer = setTimeout(() => {
      if (mountedRef.current && !isClosingRef.current) {
        startListeningRef.current()
      }
    }, 800)

    return () => {
      mountedRef.current = false
      isClosingRef.current = true
      genRef.current++
      clearTimeout(timer)
      if (finalTranscriptStopTimerRef.current) {
        clearTimeout(finalTranscriptStopTimerRef.current)
        finalTranscriptStopTimerRef.current = null
      }
      try {
        recognitionRef.current?.abort()
      } catch {}
      stopQueuedAudio()
      speechSynthesis.cancel()
      setLiveVoiceTranscript('')
      void audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
    }
  }, [setLiveVoiceTranscript])

  useEffect(() => {
    if (pendingVoiceResponse && mountedRef.current && !isClosingRef.current) {
      const timer = setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current) {
          if (Date.now() - lastStreamAudioAtRef.current < 15000) {
            setPendingVoiceResponse(null)
            return
          }
          speakResponseRef.current(pendingVoiceResponse)
          setPendingVoiceResponse(null)
        }
      }, 400)

      return () => clearTimeout(timer)
    }
  }, [pendingVoiceResponse, setPendingVoiceResponse])

  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.07]" />

      <div className="relative mx-auto flex w-full max-w-[380px] items-center rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,#070b12,#060910)] px-3 py-1.5 shadow-[0_14px_28px_rgb(0_0_0/40%),inset_0_1px_0_rgb(255_255_255/4%)]">
        <div className="min-w-0 flex-1 pr-1.5">
          <WaveformBars state={state} />
        </div>

        <div className="mx-1 h-8 w-px bg-white/10" />

        <button
          onClick={hardClose}
          className="group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-white/[0.02] transition-[background-color,border-color,color] hover:border-white/10 hover:bg-white/[0.06]"
          aria-label="Close voice input"
          title="Close voice input"
        >
          <X className="h-4 w-4 text-[#7d90b5] transition-colors group-hover:text-[#a8b6d2]" />
        </button>
      </div>

      <span className="sr-only" aria-live="polite">
        {statusText}
      </span>
    </div>
  )
}
