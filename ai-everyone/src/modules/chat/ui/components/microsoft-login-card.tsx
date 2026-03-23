// e:\SaaS-ai\ai-everyone\src\modules\chat\ui\components\teams-login-card.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'

export interface DeviceFlowData {
  user_code: string
  verification_uri: string
  message: string
  expires_in: number
}

interface MicrosoftLoginCardProps {
  deviceData: DeviceFlowData
  onAuthenticated?: () => void
}

export function MicrosoftLoginCard({ deviceData, onAuthenticated }: MicrosoftLoginCardProps) {
  const [phase, setPhase] = useState<'device_code' | 'polling' | 'success' | 'error'>('device_code')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [copied, setCopied] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => {
    setCountdown(deviceData.expires_in)
  }, [deviceData])

  useEffect(() => {
    if (phase !== 'polling') return
    const interval = setInterval(() => {
      setDots(value => (value.length >= 3 ? '' : value + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [phase])

  useEffect(() => {
    if (phase !== 'device_code' && phase !== 'polling') return
    const interval = setInterval(() => {
      setCountdown(value => {
        if (value <= 1) {
          clearInterval(interval)
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  const startPolling = useCallback(() => {
    setPhase('polling')
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/teams/auth/poll", {
          method: "POST"
        })
        if (!res.ok) throw new Error("Poll failed")
        const result = await res.json()

        if (result.status === 'authenticated') {
          clearInterval(interval)
          setPhase('success')
          if (onAuthenticated) {
            setTimeout(onAuthenticated, 1200)
          }
        } else if (result.status === 'expired') {
          clearInterval(interval)
          setError('Code expired. Please try again.')
          setPhase('error')
        }
      } catch (err) {
        // ignore fetch errors and keep polling
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [onAuthenticated])

  const handleCopyCode = async () => {
    if (!deviceData) return
    await navigator.clipboard.writeText(deviceData.user_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenBrowser = () => {
    if (!deviceData) return
    window.open('https://login.microsoft.com/device', '_blank')
    startPolling()
  }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="w-full max-w-sm mt-3 animate-fade-in font-sans">
      <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0A1520 0%, #050A0F 100%)', border: '1px solid rgba(14,165,233,0.3)' }}>
        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              <p className="text-xs font-mono text-red-400">{error}</p>
            </div>
          )}

          {(phase === 'device_code' || phase === 'polling') && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(14,165,233,0.2)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.4)' }}>1</div>
                <div className="flex-1 h-px bg-sky-900/30" />
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                  style={{
                    background: phase === 'polling' ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.03)',
                    color: phase === 'polling' ? '#0EA5E9' : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${phase === 'polling' ? 'rgba(14,165,233,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  2
                </div>
              </div>

              <p className="text-xs font-mono mb-1 text-sky-400/60">AUTHENTICATION CODE</p>
              <div className="relative mb-4 p-4 rounded-xl text-center" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <span className="text-2xl font-mono font-bold tracking-[0.25em] text-sky-400">{deviceData.user_code}</span>
                <button
                  onClick={handleCopyCode}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-150"
                  style={{
                    background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.1)',
                    color: copied ? '#10B981' : '#0EA5E9',
                    border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(14,165,233,0.2)'}`,
                  }}
                >
                  {copied ? 'OK' : 'copy'}
                </button>
              </div>

              <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-mono mb-1 text-sky-400/60">SIGN-IN URL</p>
                <p className="text-xs font-mono break-all text-white/70">{deviceData.verification_uri}</p>
              </div>

              <div className="flex items-center justify-between mb-4 text-xs font-mono text-white/40">
                <span>Code expires in</span>
                <span style={{ color: countdown < 60 ? '#F59E0B' : 'rgba(255,255,255,0.6)' }}>{formatTime(countdown)}</span>
              </div>

              {phase === 'device_code' && (
                <button
                  onClick={handleOpenBrowser}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)', color: 'white' }}
                >
                  Open sign-in page
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}

              {phase === 'polling' && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="w-4 h-4 rounded-full border-2 border-sky-900 border-t-sky-400 animate-spin" />
                  <p className="text-sm font-mono text-white/60">Waiting for sign-in{dots}</p>
                </div>
              )}
            </div>
          )}

          {phase === 'success' && (
            <div className="py-4 flex flex-col items-center gap-3 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14l5 5 11-11" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-500">Authentication successful</p>
              <p className="text-xs text-white/60 text-center">You can now proceed with your original request.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
