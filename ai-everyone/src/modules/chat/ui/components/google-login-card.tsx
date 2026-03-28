// e:\SaaS-ai\ai-everyone\src\modules\chat\ui\components\google-login-card.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'

interface GoogleLoginCardProps {
  authUrl: string
  onAuthenticated?: () => void
}

export function GoogleLoginCard({ authUrl, onAuthenticated }: GoogleLoginCardProps) {
  const [phase, setPhase] = useState<'ready' | 'polling' | 'success' | 'error'>('ready')
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (phase !== 'polling') return
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [phase])

  const startPolling = useCallback(() => {
    setPhase('polling')
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/google-auth/status')
        if (!res.ok) return
        const data = await res.json()
        if (data.authenticated) {
          clearInterval(interval)
          setPhase('success')
          if (onAuthenticated) {
            setTimeout(onAuthenticated, 1200)
          }
        }
      } catch {
        // ignore and keep polling
      }
    }, 2500)

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(interval)
      if (phase === 'polling') {
        setPhase('error')
      }
    }, 300_000)

    return () => clearInterval(interval)
  }, [onAuthenticated, phase])

  const handleSignIn = () => {
    window.open(authUrl || '/api/google-auth/login', '_blank')
    startPolling()
  }

  return (
    <div className="w-full max-w-sm mt-3 animate-fade-in font-sans">
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #0A1A10 0%, #050F0A 100%)',
          border: '1px solid rgba(34,197,94,0.3)',
        }}
      >
        <div className="p-5">

          {phase === 'ready' && (
            <div className="animate-fade-in">
              {/* Google branding header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">Google Account</p>
                  <p className="text-[10px] text-white/40 font-mono">SIGN IN REQUIRED</p>
                </div>
              </div>

              {/* Info box */}
              <div
                className="mb-4 p-3 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <p className="text-xs text-white/60 leading-relaxed">
                  To access your Google Workspace (Drive, Gmail, Calendar), you need to sign
                  in with your Google account. A new tab will open for authentication.
                </p>
              </div>

              {/* Sign in button */}
              <button
                onClick={handleSignIn}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
                  color: 'white',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

          {phase === 'polling' && (
            <div className="animate-fade-in">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-6 h-6 rounded-full border-2 border-green-900 border-t-green-400 animate-spin" />
                <p className="text-sm font-mono text-white/60">Waiting for Google sign-in{dots}</p>
                <p className="text-[10px] text-white/40 text-center">
                  Complete the sign-in in the new tab, then return here.
                </p>
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div className="py-4 flex flex-col items-center gap-3 animate-fade-in">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14l5 5 11-11" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-500">Google account connected!</p>
              <p className="text-xs text-white/60 text-center">
                You can now proceed with your original request.
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-4 flex flex-col items-center gap-3 animate-fade-in">
              <p className="text-sm text-red-400">Sign-in timed out. Please try again.</p>
              <button
                onClick={() => setPhase('ready')}
                className="px-4 py-2 rounded-lg text-xs font-mono"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#F87171',
                }}
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
