import './globals.css'
import { Inter } from 'next/font/google'

import { TRPCReactProvider } from '@/trpc/client'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'SnitchX',
  description: 'SnitchX - AI-powered workspace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TRPCReactProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className} min-h-screen bg-black text-white`}>
          {children}
        </body>
      </html>
    </TRPCReactProvider>
  )
}
