'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../stores/useAuthStore'
import PageLoading from '../layout/PageLoading'

export function homeFor(role?: string) {
  return role === 'student' ? '/student' : '/dashboard'
}

/**
 * Sign-in only exists in the browser, so the static HTML always shows the
 * loading state and the real screen appears once this has checked the session.
 */
export default function AuthGuard({ role, children }: { role: 'teacher' | 'student'; children: ReactNode }) {
  const router = useRouter()
  const { isLoggedIn, user } = useAuthStore()
  const [ready, setReady] = useState(false)
  const allowed = isLoggedIn && user?.role === role

  useEffect(() => setReady(true), [])

  useEffect(() => {
    if (!ready || allowed) return
    router.replace(isLoggedIn ? homeFor(user?.role) : '/login')
  }, [ready, allowed, isLoggedIn, user?.role, router])

  return ready && allowed ? <>{children}</> : <PageLoading />
}

/** For the sign-in pages and `/`: anyone already signed in goes to their home. */
export function RedirectHome({ children }: { children?: ReactNode }) {
  const router = useRouter()
  const { isLoggedIn, user } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => setReady(true), [])

  useEffect(() => {
    if (ready && isLoggedIn) router.replace(homeFor(user?.role))
    else if (ready && !children) router.replace('/login')
  }, [ready, isLoggedIn, user?.role, router, children])

  return ready && !isLoggedIn && children ? <>{children}</> : <PageLoading />
}
