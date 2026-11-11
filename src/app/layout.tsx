import { Suspense, type ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
// Self-hosted so the app needs no network for fonts (true offline use).
import '@fontsource-variable/plus-jakarta-sans'
import '../index.css'
import PageLoading from '@/components/layout/PageLoading'

export const metadata: Metadata = {
  title: 'SkoolBox',
  description: 'AI teaching assistant for Nigerian primary and secondary schools.',
  icons: { icon: '/logo.svg' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </body>
    </html>
  )
}
