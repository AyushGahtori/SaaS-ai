import './globals.css'
import { Inter } from 'next/font/google'

import { NetworkHints } from "@/components/performance/network-hints";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <NetworkHints />
      </head>
      <body suppressHydrationWarning className={`${inter.className} min-h-screen bg-black text-white`}>
        {children}
      </body>
    </html>
  )
}
