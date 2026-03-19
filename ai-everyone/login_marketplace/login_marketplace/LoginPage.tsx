// D:\techsnitch\micro_login\frontend\components\LoginPage.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { pollAuth, startAuth } from '@/lib/api'

interface DeviceFlowData {
  user_code: string
  verification_uri: string
  message: string
  expires_in: number
}

interface UserInfo {
  displayName: string
  email: string
  id: string
}

interface LoginPageProps {
  onAuthenticated: (user: UserInfo) => void
}

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'device_code' | 'polling' | 'success' | 'error'>('idle')
  const [deviceData, setDeviceData] = useState<DeviceFlowData | null>(null)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [copied, setCopied] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (phase !== 'polling') return
    const interval = setInterval(() => {
      setDots(value => (value.length >= 3 ? '' : value + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [phase])

  useEffect(() => {
    if (!deviceData || (phase !== 'device_code' && phase !== 'polling')) return
    setCountdown(deviceData.expires_in)
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
  }, [deviceData, phase])

  const startPolling = useCallback(() => {
    setPhase('polling')
    const interval = setInterval(async () => {
      try {
        const result = await pollAuth()
        if (result.status === 'authenticated') {
          clearInterval(interval)
          setPhase('success')
          setTimeout(() => onAuthenticated(result.user), 1200)
        } else if (result.status === 'expired') {
          clearInterval(interval)
          setError('Code expired. Please try again.')
          setPhase('error')
        }
      } catch {
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [onAuthenticated])

  const handleSignIn = async () => {
    setPhase('loading')
    setError('')
    try {
      const data = await startAuth()
      if (data.status === 'already_authenticated') {
        setPhase('success')
        setTimeout(() => onAuthenticated(data.user), 800)
        return
      }
      setDeviceData(data)
      setPhase('device_code')
    } catch {
      setError('Could not connect to the authentication server.')
      setPhase('error')
    }
  }

  const handleCopyCode = async () => {
    if (!deviceData) return
    await navigator.clipboard.writeText(deviceData.user_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenBrowser = () => {
  if (!deviceData) return
  window.open('https://microsoft.com/devicelogin', '_blank')  // ← hardcode this
  startPolling()
}

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-8 py-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-xs font-mono text-sky-400/60 tracking-[0.2em] uppercase">
            Teams AI Assistant
          </span>
        </div>
        <div className="text-xs font-mono text-sky-900">v1.0.0</div>
      </div>

      <div className="fixed top-16 left-6 w-8 h-8 border-l border-t border-sky-900/50" />
      <div className="fixed top-16 right-6 w-8 h-8 border-r border-t border-sky-900/50" />
      <div className="fixed bottom-6 left-6 w-8 h-8 border-l border-b border-sky-900/50" />
      <div className="fixed bottom-6 right-6 w-8 h-8 border-r border-b border-sky-900/50" />

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border border-sky-500/20 scale-150 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-full border border-sky-500/10 scale-[2]" style={{ animation: 'pulse-ring 3s ease-out 1.5s infinite' }} />
            <div
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center animate-glow-pulse"
              style={{ background: 'linear-gradient(135deg, #0F1E2E 0%, #0A1520 100%)', border: '1px solid rgba(14,165,233,0.3)' }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="8" width="22" height="24" rx="3" fill="rgba(14,165,233,0.15)" stroke="rgba(14,165,233,0.5)" strokeWidth="1" />
                <rect x="14" y="4" width="22" height="24" rx="3" fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
                <text x="9" y="24" fill="#38BDF8" fontSize="16" fontWeight="700" fontFamily="Syne, sans-serif">T</text>
                <circle cx="31" cy="9" r="5" fill="#0EA5E9" />
                <text x="28.5" y="12.5" fill="white" fontSize="8" fontWeight="700">AI</text>
              </svg>
            </div>
          </div>
        </div>

        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
            Teams Assistant
          </h1>
          <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
            Microsoft identity authentication required
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl animate-slide-up delay-100" style={{ background: 'linear-gradient(135deg, #0A1520 0%, #050A0F 100%)', border: '1px solid var(--border-bright)' }}>
          <div className="absolute left-0 right-0 h-px opacity-30" style={{ background: 'linear-gradient(90deg, transparent, #0EA5E9, transparent)', animation: 'scan-line 4s linear infinite' }} />

          <div className="p-8">
            {(phase === 'idle' || phase === 'error') && (
              <div className="animate-fade-in">
                <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.1)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Sign in with your Microsoft work account to access Teams contacts and launch calls or messages via AI.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <p className="text-xs font-mono text-red-400">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSignIn}
                  className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-3"
                  style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)', color: 'white', boxShadow: '0 0 30px rgba(14,165,233,0.25)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 0 40px rgba(14,165,233,0.45)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(14,165,233,0.25)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="1" y="1" width="7" height="7" fill="#ffffff" fillOpacity="0.9" />
                    <rect x="10" y="1" width="7" height="7" fill="#ffffff" fillOpacity="0.7" />
                    <rect x="1" y="10" width="7" height="7" fill="#ffffff" fillOpacity="0.7" />
                    <rect x="10" y="10" width="7" height="7" fill="#ffffff" fillOpacity="0.9" />
                  </svg>
                  Sign in with Microsoft
                </button>

                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Device Code Flow</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                </div>
              </div>
            )}

            {phase === 'loading' && (
              <div className="py-8 flex flex-col items-center gap-4 animate-fade-in">
                <div className="relative w-12 h-12">
                  <div className="w-12 h-12 rounded-full border-2 border-sky-900 absolute" />
                  <div className="w-12 h-12 rounded-full border-2 border-t-sky-400 animate-spin absolute" />
                </div>
                <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>Connecting to Microsoft...</p>
              </div>
            )}

            {(phase === 'device_code' || phase === 'polling') && deviceData && (
              <div className="animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(14,165,233,0.2)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.4)' }}>1</div>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: phase === 'polling' ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.03)',
                      color: phase === 'polling' ? '#0EA5E9' : 'var(--text-muted)',
                      border: `1px solid ${phase === 'polling' ? 'rgba(14,165,233,0.4)' : 'var(--border)'}`,
                    }}
                  >
                    2
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>OK</div>
                </div>

                <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>AUTHENTICATION CODE</p>

                <div className="relative mb-4 p-5 rounded-xl text-center" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <span className="text-3xl font-mono font-bold tracking-[0.3em]" style={{ color: '#38BDF8' }}>{deviceData.user_code}</span>
                  <button
                    onClick={handleCopyCode}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-xs font-mono transition-all duration-150"
                    style={{
                      background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.1)',
                      color: copied ? '#10B981' : '#0EA5E9',
                      border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(14,165,233,0.2)'}`,
                    }}
                  >
                    {copied ? 'OK' : 'copy'}
                  </button>
                </div>

                <div className="mb-5 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>SIGN-IN URL</p>
                  <p className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>{deviceData.verification_uri}</p>
                </div>

                <div className="flex items-center justify-between mb-5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  <span>Code expires in</span>
                  <span style={{ color: countdown < 60 ? '#F59E0B' : 'var(--text-secondary)' }}>{formatTime(countdown)}</span>
                </div>

                {phase === 'device_code' && (
                  <button
                    onClick={handleOpenBrowser}
                    className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)', color: 'white', boxShadow: '0 0 30px rgba(14,165,233,0.25)' }}
                  >
                    Open sign-in page & continue
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}

                {phase === 'polling' && (
                  <div className="flex items-center justify-center gap-3 py-3">
                    <div className="w-4 h-4 rounded-full border-2 border-sky-900 border-t-sky-400 animate-spin" />
                    <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>Waiting for sign-in{dots}</p>
                  </div>
                )}
              </div>
            )}

            {phase === 'success' && (
              <div className="py-6 flex flex-col items-center gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 30px rgba(16,185,129,0.15)' }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M6 14l5 5 11-11" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-base font-semibold" style={{ color: '#10B981' }}>Authentication successful</p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Launching assistant...</p>
              </div>
            )}
          </div>

          <div className="px-8 py-4 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              Secured by Microsoft Entra | OAuth 2.0 Device Code
            </p>
          </div>
        </div>

        <p className="text-center text-xs font-mono mt-6 animate-slide-up delay-300" style={{ color: 'var(--text-muted)' }}>
          Your credentials are never stored locally
        </p>
      </div>
    </div>
  )
}
