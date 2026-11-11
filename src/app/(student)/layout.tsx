'use client'

import type { ReactNode } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Shell from '@/components/layout/StudentLayout'

export default function GroupLayout({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <AuthGuard role="student">{children}</AuthGuard>
    </Shell>
  )
}
