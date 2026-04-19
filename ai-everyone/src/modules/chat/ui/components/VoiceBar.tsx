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
  ) => Promise<{ type: string; content?: string; taskId?: string } | undefined>
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

export default function VoiceBar({ onSendMessage, onClose, onFirstMessage }: VoiceBarProps) {
  const [state, setState] = useState<VoiceBarState>('connecting')
  const [statusText, setStatusText] = useState('Starting...')

  const { pendingVoiceResponse, setPendingVoiceResponse } = useChatContext()

  const recognitionRef = useRef<any>(null)
  const isSpeakingRef = useRef(false)
  const isClosingRef = useRef(false)
  const interimTextRef = useRef('')
  const mountedRef = useRef(true)
  const genRef = useRef(0)

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

  const pickVoice = () => {
    const all = speechSynthesis.getVoices()
    return (
      all.find((v) => v.name.includes('Google UK English Female')) ||
      all.find((v) => v.name.includes('Google')) ||
      all.find((v) => v.name.includes('Microsoft')) ||
      all[0]
    )
  }

  const hardClose = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    mountedRef.current = false
    genRef.current++
    try {
      recognitionRef.current?.abort()
    } catch {}
    speechSynthesis.cancel()
    onCloseRef.current()
  }

  const speakResponse = (text: string) => {
    if (!mountedRef.current || isClosingRef.current) return

    isSpeakingRef.current = true
    setState('speaking')
    setStatusText('Speaking...')

    try {
      recognitionRef.current?.abort()
    } catch {}

    speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) utter.voice = voice

    utter.rate = 0.95
    utter.pitch = 1.05
    utter.volume = 1

    utter.onend = () => {
      if (!mountedRef.current || isClosingRef.current) return
      isSpeakingRef.current = false
      setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current) startListening()
      }, 500)
    }

    utter.onerror = () => {
      isSpeakingRef.current = false
      if (mountedRef.current && !isClosingRef.current) {
        setTimeout(startListening, 500)
      }
    }

    speechSynthesis.speak(utter)
  }

  const startListeningRef = useRef<() => void>(() => {})

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

    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
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
      setState('listening')
      setStatusText('Listening...')
    }

    rec.onresult = (event: any) => {
      if (genRef.current !== myGen) return
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript
        if (event.results[i].isFinal) interimTextRef.current = text
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
      if (!mountedRef.current || isClosingRef.current) return

      const said = interimTextRef.current.trim()
      interimTextRef.current = ''

      if (!said) {
        if (!isSpeakingRef.current) {
          setTimeout(() => {
            if (mountedRef.current) startListening()
          }, 200)
        }
        return
      }

      if (CLOSE_INTENT.test(said)) {
        hardClose()
        return
      }

      if (isSpeakingRef.current) return

      setState('thinking')
      setStatusText('Processing...')
      onFirstMessageRef.current?.()

      onSendMessageRef.current(said, true)
        .then((responseData) => {
          if (!mountedRef.current || isClosingRef.current) {
            if (responseData) {
              const textToSpeak =
                responseData.type === 'agent_task'
                  ? 'Task has been submitted. Please wait.'
                  : responseData.content || "I'm not sure what to say."
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
            setStatusText('Agent working...')

            const unsub = subscribeToTask(taskId, (task) => {
              if (!task) return

              if (task.status === 'success') {
                unsub()
                const message = (task.agentOutput?.message || 'I have completed the task.') as string
                speakResponse(message)
              } else if (task.status === 'failed') {
                unsub()
                speakResponse('Sorry, I encountered an error.')
              }
            })
          } else {
            speakResponse(responseData.content || "I'm not sure what to say.")
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            speakResponse('Sorry, there was a connection problem.')
          }
        })
    }

    rec.start()
  }

  startListeningRef.current = startListening

  useEffect(() => {
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

    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
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
      try {
        recognitionRef.current?.abort()
      } catch {}
      speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    if (pendingVoiceResponse && mountedRef.current && !isClosingRef.current) {
      const timer = setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current) {
          speakResponse(pendingVoiceResponse)
          setPendingVoiceResponse(null)
        }
      }, 400)

      return () => clearTimeout(timer)
    }
  }, [pendingVoiceResponse])

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
