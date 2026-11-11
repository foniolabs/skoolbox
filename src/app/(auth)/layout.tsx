'use client'

import type { ReactNode } from 'react'
import { RedirectHome } from '@/components/auth/AuthGuard'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <RedirectHome>{children}</RedirectHome>
}
