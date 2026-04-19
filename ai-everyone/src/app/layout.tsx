import './globals.css'
import { Manrope, Space_Grotesk } from 'next/font/google'

import { TRPCReactProvider } from '@/trpc/client'
import { FirestoreAbortNoiseGuard } from '@/components/dev/firestore-abort-noise-guard'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

export const metadata = {
  title: 'Pian',
  description: 'Pian - AI-powered workspace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TRPCReactProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          suppressHydrationWarning
          className={`${manrope.variable} ${spaceGrotesk.variable} min-h-screen bg-background text-foreground antialiased`}
        >
          <FirestoreAbortNoiseGuard />
          {children}
        </body>
      </html>
    </TRPCReactProvider>
  )
}
