'use client'

import type { ReactNode } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Shell from '@/components/layout/Layout'

export default function GroupLayout({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <AuthGuard role="teacher">{children}</AuthGuard>
    </Shell>
  )
}
