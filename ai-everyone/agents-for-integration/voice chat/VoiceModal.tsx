'use client'

import { useEffect, useRef, useState } from "react"

export interface VoiceTranscriptEntry {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface Props {
  onTranscript: (text: string, callback: (response: string, actionUrl?: string) => void) => void
  onClose: (transcripts: VoiceTranscriptEntry[]) => void
}

type VoiceState = "welcome" | "listening" | "thinking" | "speaking"

// ── Soundwave ─────────────────────────────────────────────────────────────────
function SoundWave() {
  const heights = [16, 26, 36, 46, 54, 46, 36, 26, 36, 46, 36, 26, 16]
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, height:68, width:"100%", padding:"0 22px" }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width:4, height:h, borderRadius:4, background:"rgba(255,255,255,0.92)",
          transformOrigin:"center center",
          animation:`swBar ${0.5+(i%5)*0.12}s ease-in-out infinite alternate`,
          animationDelay:`${i*0.06}s`,
        }} />
      ))}
    </div>
  )
}

// ── Pulse rings ───────────────────────────────────────────────────────────────
function PulseRings({ color }: { color:string }) {
  return (
    <>
      {[0,1,2].map(i => (
        <div key={i} style={{
          position:"absolute", inset:-2, borderRadius:"50%",
          border:`2px solid ${color}`,
          animation:`pulseRing ${1.4+i*0.35}s ease-out infinite`,
          animationDelay:`${i*0.35}s`,
          pointerEvents:"none",
        }} />
      ))}
    </>
  )
}

// ── Faces ─────────────────────────────────────────────────────────────────────
function SpeakingFace() {
  return (
    <svg viewBox="0 0 100 100" width="90" height="90" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="35" cy="38" rx="5" ry="5.5" fill="white" opacity="0.95"/>
      <ellipse cx="65" cy="38" rx="5" ry="5.5" fill="white" opacity="0.95"/>
      <circle cx="37" cy="36" r="1.8" fill="rgba(0,0,0,0.3)"/>
      <circle cx="67" cy="36" r="1.8" fill="rgba(0,0,0,0.3)"/>
      <path d="M28 30 Q35 26 42 29" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <path d="M58 29 Q65 26 72 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <g>
        <ellipse cx="50" cy="66" rx="13" ry="8" fill="white" opacity="0.9">
          <animate attributeName="ry" values="8;4;9;5;8" dur="0.7s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx="50" cy="66" rx="10" ry="5" fill="rgba(0,80,160,0.5)">
          <animate attributeName="ry" values="5;2;6;3;5" dur="0.7s" repeatCount="indefinite"/>
        </ellipse>
      </g>
    </svg>
  )
}

function ThinkingFace() {
  return (
    <svg viewBox="0 0 100 100" width="90" height="90" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="35" cy="38" rx="5" ry="5.5" fill="white" opacity="0.95"/>
      <ellipse cx="65" cy="38" rx="5" ry="5.5" fill="white" opacity="0.95"/>
      <circle cx="37" cy="35" r="2.5" fill="rgba(0,0,0,0.35)">
        <animate attributeName="cx" values="37;38;37" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="35;34;35" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="67" cy="35" r="2.5" fill="rgba(0,0,0,0.35)">
        <animate attributeName="cx" values="67;68;67" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="35;34;35" dur="2s" repeatCount="indefinite"/>
      </circle>
      <path d="M28 30 Q35 25 42 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8">
        <animate attributeName="d" values="M28 30 Q35 25 42 28;M28 28 Q35 23 42 26;M28 30 Q35 25 42 28" dur="2s" repeatCount="indefinite"/>
      </path>
      <path d="M58 28 Q65 26 72 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <path d="M40 67 Q50 63 60 67" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85">
        <animate attributeName="d" values="M40 67 Q50 63 60 67;M40 66 Q50 64 60 66;M40 67 Q50 63 60 67" dur="2s" repeatCount="indefinite"/>
      </path>
    </svg>
  )
}

// ── Goodbye phrases ───────────────────────────────────────────────────────────
const GOODBYE_PHRASES = [
  "Bye bye! See you soon.",
  "Goodbye! Have a great day.",
  "See you later! Take care.",
  "Bye! Let me know if you need anything.",
]

const CLOSE_INTENT = /\b(close|close voice|close assistant|stop listening|exit|goodbye|that'?s? all|finish|end session|quit)\b/i

// ── Main component ────────────────────────────────────────────────────────────
export default function VoiceModal({ onTranscript, onClose }: Props) {

  const [voiceState, setVoiceState]       = useState<VoiceState>("welcome")
  const [liveText, setLiveText]           = useState("")
  const [transcripts, setTranscripts]     = useState<VoiceTranscriptEntry[]>([])
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const recognitionRef  = useRef<any>(null)
  const isSpeakingRef   = useRef(true)   // true until welcome finishes
  const isClosingRef    = useRef(false)
  const interimTextRef  = useRef("")
  const transcriptsRef  = useRef<VoiceTranscriptEntry[]>([])
  const onTranscriptRef = useRef(onTranscript)
  const onCloseRef      = useRef(onClose)
  const scrollRef       = useRef<HTMLDivElement>(null)
  const thinkingAudioRef = useRef<HTMLAudioElement | null>(null)
  const mountedRef      = useRef(true)

  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pushTranscript = (entry: VoiceTranscriptEntry) => {
    transcriptsRef.current = [...transcriptsRef.current, entry]
    setTranscripts([...transcriptsRef.current])
  }

  // Say goodbye then close
  const sayGoodbyeAndClose = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    try { recognitionRef.current?.abort() } catch {}
    stopThinkingAudio()

    const phrase = GOODBYE_PHRASES[Math.floor(Math.random() * GOODBYE_PHRASES.length)]
    setVoiceState("speaking")
    isSpeakingRef.current = true

    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(phrase)
    const v = pickVoice(); if (v) utter.voice = v
    utter.rate = 0.95; utter.pitch = 1.05

    const finish = () => {
      mountedRef.current = false
      onCloseRef.current(transcriptsRef.current)
    }
    utter.onend  = finish
    utter.onerror = finish
    speechSynthesis.speak(utter)
  }

  // Hard close (X button) — no goodbye speech
  const hardClose = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    mountedRef.current   = false
    try { recognitionRef.current?.abort() } catch {}
    speechSynthesis.cancel()
    stopThinkingAudio()
    onCloseRef.current(transcriptsRef.current)
  }

  const getOrCreateAudio = () => {
    if (!thinkingAudioRef.current) {
      try {
        const a = new Audio("/thinking.mp3")
        a.loop = true
        thinkingAudioRef.current = a
      } catch { return null }
    }
    return thinkingAudioRef.current
  }

  const playThinkingAudio = () => {
    const a = getOrCreateAudio(); if (!a) return
    a.currentTime = 0; a.play().catch(() => {})
  }

  const stopThinkingAudio = () => {
    const a = thinkingAudioRef.current; if (!a) return
    a.pause(); a.currentTime = 0
  }

  const pickVoice = () => {
    const all = speechSynthesis.getVoices()
    return (
      all.find(v => v.name.includes("Google UK English Female")) ||
      all.find(v => v.name.includes("Google")) ||
      all.find(v => v.name.includes("Microsoft")) ||
      all[0]
    )
  }

  // ── Speak response, then listen ────────────────────────────────────────────

  const speakResponse = (text: string) => {
    if (!mountedRef.current || isClosingRef.current) return
    isSpeakingRef.current = true
    setVoiceState("speaking")
    stopThinkingAudio()
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

  // ── Listen loop ────────────────────────────────────────────────────────────

  // Stored in a ref so visibilitychange/focus handlers always call the latest closure
  const startListeningRef = useRef<() => void>(() => {})

  const startListening = () => {
    if (!mountedRef.current || isClosingRef.current || isSpeakingRef.current) return
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      setTimeout(() => { if (mountedRef.current) startListening() }, 300)
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    try { recognitionRef.current?.abort() } catch {}

    const rec = new SR()
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = true
    recognitionRef.current = rec

    rec.onstart = () => {
      if (!mountedRef.current || isSpeakingRef.current) { try { rec.abort() } catch {} return }
      interimTextRef.current = ""
      setLiveText("")
      setVoiceState("listening")
    }

    rec.onresult = (e: any) => {
      let text = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript
        if (e.results[i].isFinal) interimTextRef.current = text
      }
      setLiveText(text)
    }

    rec.onerror = (e: any) => {
      if (e.error === "aborted") return
      // Any other error (no-speech, not-allowed, etc.) — restart after delay
      setTimeout(() => {
        if (mountedRef.current && !isClosingRef.current && !isSpeakingRef.current) startListening()
      }, 600)
    }

    rec.onend = () => {
      if (!mountedRef.current || isClosingRef.current) return

      const said = interimTextRef.current.trim()
      interimTextRef.current = ""
      setLiveText("")

      if (!said) {
        if (!isSpeakingRef.current) setTimeout(() => { if (mountedRef.current) startListening() }, 200)
        return
      }

      // Close intent — say goodbye first
      if (CLOSE_INTENT.test(said)) {
        pushTranscript({ role: "user", content: said, timestamp: new Date() })
        sayGoodbyeAndClose()
        return
      }

      if (isSpeakingRef.current) return

      pushTranscript({ role: "user", content: said, timestamp: new Date() })
      setVoiceState("thinking")
      playThinkingAudio()

      onTranscriptRef.current(said, (response: string, actionUrl?: string) => {
        if (!mountedRef.current || isClosingRef.current) return
        stopThinkingAudio()
        pushTranscript({ role: "assistant", content: response, timestamp: new Date() })

        // Store the action URL for the manual button — but NEVER auto-open anything.
        // The agent's spoken response IS the confirmation. No windows open.
        if (actionUrl) setPendingAction(actionUrl)

        speakResponse(response)
      })
    }

    rec.start()
  }

  // Always keep ref pointing to latest startListening
  startListeningRef.current = startListening

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current    = true
    isClosingRef.current  = false
    isSpeakingRef.current = true

    let welcomeTimer: ReturnType<typeof setTimeout>

    const sayWelcome = () => {
      if (!mountedRef.current) return
      setVoiceState("speaking")
      speechSynthesis.cancel()

      welcomeTimer = setTimeout(() => {
        if (!mountedRef.current) return
        const welcome = new SpeechSynthesisUtterance("Hi there! What can I do for you?")
        const v = pickVoice(); if (v) welcome.voice = v
        welcome.rate = 0.95; welcome.pitch = 1.05

        welcome.onend = () => {
          if (!mountedRef.current) return
          isSpeakingRef.current = false
          setTimeout(() => { if (mountedRef.current) startListening() }, 600)
        }
        welcome.onerror = () => {
          isSpeakingRef.current = false
          if (mountedRef.current) setTimeout(startListening, 600)
        }
        speechSynthesis.speak(welcome)
      }, 150)
    }

    if (speechSynthesis.getVoices().length > 0) {
      sayWelcome()
    } else {
      speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.onvoiceschanged = null
        sayWelcome()
      }
    }

    return () => {
      mountedRef.current   = false
      isClosingRef.current = true
      clearTimeout(welcomeTimer)
      speechSynthesis.onvoiceschanged = null
      try { recognitionRef.current?.abort() } catch {}
      speechSynthesis.cancel()
      stopThinkingAudio()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [transcripts])

  // ── Restart listening when user returns from Teams (or any other window) ──
  // visibilitychange fires when switching browser tabs
  // window focus fires when returning from a desktop app (Teams)
  useEffect(() => {
    const onReturn = () => {
      if (!mountedRef.current || isClosingRef.current || isSpeakingRef.current) return
      // Abort any dead recognition session first, then restart fresh
      try { recognitionRef.current?.abort() } catch {}
      // Wait 400ms for browser to fully restore mic permission after focus returns
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI ────────────────────────────────────────────────────────────────────

  const circleGradient =
    voiceState === "listening"
      ? "linear-gradient(135deg,#15803d 0%,#16a34a 40%,#22c55e 80%,#4ade80 100%)"
      : voiceState === "thinking"
      ? "linear-gradient(135deg,#9a3412 0%,#c2410c 35%,#ea580c 65%,#f97316 100%)"
      : "linear-gradient(135deg,#0369a1 0%,#0284c7 50%,#38bdf8 100%)"

  const circleAnim =
    voiceState === "thinking"    ? "orangePulse 1.5s ease-in-out infinite"
    : voiceState === "listening" ? "greenGlow   2s   ease-in-out infinite"
    :                              "blueGlow    2s   ease-in-out infinite"

  const ringColor = voiceState === "thinking" ? "rgba(251,146,60,0.42)" : "rgba(56,189,248,0.35)"
  const showRings = voiceState !== "listening"

  return (
    <>
      <style>{`
        @keyframes swBar {
          from { transform:scaleY(0.25); opacity:0.65; }
          to   { transform:scaleY(1.0);  opacity:1.0;  }
        }
        @keyframes pulseRing {
          0%   { transform:scale(1.0); opacity:0.7; }
          100% { transform:scale(2.1); opacity:0;   }
        }
        @keyframes orangePulse {
          0%,100% { box-shadow:0 0 32px rgba(249,115,22,0.55),0 0 64px rgba(249,115,22,0.22); }
          50%     { box-shadow:0 0 56px rgba(251,146,60,0.85),0 0 110px rgba(251,146,60,0.38); }
        }
        @keyframes greenGlow {
          0%,100% { box-shadow:0 0 24px rgba(34,197,94,0.45),0 0 52px rgba(34,197,94,0.18); }
          50%     { box-shadow:0 0 46px rgba(74,222,128,0.72),0 0 90px rgba(74,222,128,0.3); }
        }
        @keyframes blueGlow {
          0%,100% { box-shadow:0 0 28px rgba(14,165,233,0.5),0 0 56px rgba(14,165,233,0.2); }
          50%     { box-shadow:0 0 52px rgba(56,189,248,0.82),0 0 100px rgba(56,189,248,0.35); }
        }
        @keyframes modalIn {
          from { opacity:0; transform:scale(0.97); }
          to   { opacity:1; transform:scale(1); }
        }
        .vc-scroll::-webkit-scrollbar { width:3px; }
        .vc-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.07); border-radius:3px; }
      `}</style>

      <div style={{
        position:"fixed", inset:0, zIndex:9999,
        background:"rgba(1,5,10,0.92)",
        backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)",
        display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"flex-start", paddingTop:48,
        animation:"modalIn 0.2s ease-out", overflow:"hidden",
      }}
        onClick={e => { if (e.target === e.currentTarget) hardClose() }}
      >
        {/* Close button — hard close, no goodbye */}
        <button onClick={hardClose} style={{
          position:"absolute", top:20, right:24,
          width:36, height:36, borderRadius:8,
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
          color:"#64748b", fontSize:18, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.12)"; e.currentTarget.style.color="#e2e8f0" }}
          onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="#64748b" }}
        >✕</button>

        <p style={{
          fontFamily:"'IBM Plex Mono',monospace", fontSize:10,
          color:"#38bdf8", letterSpacing:"0.22em",
          textTransform:"uppercase", marginBottom:32, opacity:0.65,
        }}>◈ Voice Session</p>

        {/* Circle */}
        <div style={{ position:"relative", width:190, height:190, marginBottom:20, flexShrink:0 }}>
          {showRings && <PulseRings color={ringColor} />}
          <div style={{
            width:190, height:190, borderRadius:"50%",
            background:circleGradient,
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"background 0.45s ease", animation:circleAnim,
            cursor: voiceState==="listening" ? "pointer" : "default",
            position:"relative",
          }}
            onClick={() => { if (voiceState==="listening") try { recognitionRef.current?.stop() } catch {} }}
          >
            {voiceState==="listening" ? <SoundWave />
            : voiceState==="thinking" ? <ThinkingFace />
            : <SpeakingFace />}
          </div>
        </div>

        {/* Status */}
        {voiceState==="thinking" ? (
          <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontStyle:"italic", color:"#fb923c", marginBottom:10 }}>
            Model is performing your task...
          </p>
        ) : (
          <p style={{
            fontFamily:"'IBM Plex Mono',monospace", fontSize:13, marginBottom:10, letterSpacing:"0.05em",
            color: voiceState==="listening" ? "#4ade80" : voiceState==="speaking" ? "#38bdf8" : "#475569",
          }}>
            {voiceState==="listening" ? "Listening…" : voiceState==="speaking" ? "Speaking…" : "Starting…"}
          </p>
        )}

        {/* Teams action button — opens link then immediately refocuses this window */}
        {pendingAction && (
          <button onClick={() => {
            const a = document.createElement('a')
            a.href = pendingAction!
            a.rel  = 'noopener'
            if (!pendingAction!.startsWith('msteams:')) a.target = '_blank'
            document.body.appendChild(a)
            a.click()
            setTimeout(() => { try { document.body.removeChild(a) } catch {} }, 500)
            // Pull focus back so the browser tab stays active and mic can restart
            setTimeout(() => { window.focus() }, 300)
          }} style={{
            marginBottom:12, padding:"8px 18px", borderRadius:10,
            background:"rgba(14,165,233,0.15)", border:"1px solid rgba(14,165,233,0.35)",
            color:"#38bdf8", fontFamily:"'IBM Plex Mono',monospace", fontSize:12,
            cursor:"pointer", display:"flex", alignItems:"center", gap:8, transition:"all 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(14,165,233,0.28)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(14,165,233,0.15)"}
          >↗ Open in Teams</button>
        )}

        {/* Live interim */}
        {liveText && voiceState==="listening" && (
          <div style={{
            maxWidth:460, textAlign:"center",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:13,
            color:"#94a3b8", lineHeight:1.6,
            padding:"8px 18px", marginBottom:10,
            background:"rgba(255,255,255,0.03)", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.06)",
          }}>{liveText}</div>
        )}

        {/* Transcript */}
        {transcripts.length > 0 && (
          <div ref={scrollRef} className="vc-scroll" style={{
            width:"100%", maxWidth:520,
            maxHeight:"calc(100vh - 460px)", minHeight:60,
            overflowY:"auto", marginTop:14,
            display:"flex", flexDirection:"column", gap:8,
            padding:"0 20px 20px",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.05)" }} />
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#334155", letterSpacing:"0.18em" }}>TRANSCRIPT</span>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.05)" }} />
            </div>
            {transcripts.map((t, i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:t.role==="user" ? "flex-end" : "flex-start" }}>
                <span style={{
                  fontFamily:"'IBM Plex Mono',monospace", fontSize:9, marginBottom:3,
                  color:t.role==="user" ? "#38bdf8" : "#64748b",
                  textTransform:"uppercase", letterSpacing:"0.1em",
                }}>
                  {t.role==="user" ? "You" : "Copilot"} · {new Date(t.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                </span>
                <div style={{
                  maxWidth:"82%", padding:"8px 12px",
                  borderRadius:t.role==="user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background:t.role==="user" ? "rgba(14,165,233,0.12)" : "rgba(20,30,45,0.8)",
                  border:t.role==="user" ? "1px solid rgba(14,165,233,0.22)" : "1px solid rgba(100,116,139,0.18)",
                  color:"#e2e8f0", fontSize:13, lineHeight:1.55,
                }}>{t.content}</div>
              </div>
            ))}
          </div>
        )}

        <p style={{
          position:"absolute", bottom:18,
          fontFamily:"'IBM Plex Mono',monospace", fontSize:9,
          color:"#1e293b", letterSpacing:"0.12em",
        }}>Say "bye" or "done" to end · ✕ to dismiss</p>

      </div>
    </>
  )
}
