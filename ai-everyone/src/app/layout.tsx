import './globals.css'
import { Inter } from 'next/font/google'

import { TRPCReactProvider } from '@/trpc/client'
import { FirestoreAbortNoiseGuard } from '@/components/dev/firestore-abort-noise-guard'

const inter = Inter({ subsets: ['latin'] })

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
        <body suppressHydrationWarning className={`${inter.className} min-h-screen bg-black text-white`}>
          <FirestoreAbortNoiseGuard />
          {children}
        </body>
      </html>
    </TRPCReactProvider>
  )
}
