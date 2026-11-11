'use client'

/**
 * Small routing layer over Next.js so screens keep one simple API.
 *
 * A static export can't generate pages for ids it doesn't know at build time
 * (a teacher's own quizzes and plans), so those screens live on one fixed page
 * and take their ids as query parameters. `toHref` does that mapping, letting
 * the app keep writing paths like `/assess/quiz-1`.
 */
import { useEffect, type AnchorHTMLAttributes, type ReactNode } from 'react'
import NextLink from 'next/link'
import {
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'

const idRoutes: { pattern: RegExp; page: string; keys: string[] }[] = [
  {
    pattern: /^\/student\/subjects\/([^/]+)\/topics\/([^/]+)$/,
    page: '/student/subjects/topic',
    keys: ['subjectId', 'topicId'],
  },
  { pattern: /^\/assess\/([^/]+)$/, page: '/assess/play', keys: ['quizId'] },
  { pattern: /^\/curriculum\/([^/]+)$/, page: '/curriculum/plan', keys: ['planId'] },
  { pattern: /^\/prepare\/(?!lesson-planner$)([^/]+)$/, page: '/prepare/subject', keys: ['subjectId'] },
]

export function toHref(to: string): string {
  const [path, query] = to.split('?')
  for (const { pattern, page, keys } of idRoutes) {
    const match = path.match(pattern)
    if (!match) continue
    const params = new URLSearchParams(query)
    keys.forEach((key, i) => params.set(key, decodeURIComponent(match[i + 1])))
    return `${page}?${params}`
  }
  return to
}

// Holds `navigate(path, { state })` for the next screen to read.
let pendingState: unknown = null

interface NavigateOptions {
  replace?: boolean
  state?: unknown
}

export function useNavigate() {
  const router = useRouter()
  return (to: string | number, options?: NavigateOptions) => {
    if (typeof to === 'number') {
      router.back()
      return
    }
    pendingState = options?.state ?? null
    if (options?.replace) router.replace(toHref(to))
    else router.push(toHref(to))
  }
}

export function useLocation() {
  const pathname = usePathname()
  const search = useNextSearchParams().toString()
  return { pathname, search: search ? `?${search}` : '', state: pendingState }
}

export function useParams<T extends Record<string, string | undefined>>(): Partial<T> {
  const params = useNextSearchParams()
  return Object.fromEntries(params.entries()) as Partial<T>
}

export function useSearchParams() {
  return [useNextSearchParams()] as const
}

export function Navigate({ to, replace = true }: { to: string; replace?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (replace) router.replace(toHref(to))
    else router.push(toHref(to))
  }, [router, to, replace])
  return null
}

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>

export function Link({
  to,
  className,
  children,
  ...rest
}: AnchorProps & { to: string; className?: string; children?: ReactNode }) {
  return (
    <NextLink href={toHref(to)} className={className} {...rest}>
      {children}
    </NextLink>
  )
}

export function NavLink({
  to,
  end,
  className,
  children,
  ...rest
}: AnchorProps & {
  to: string
  end?: boolean
  className?: string | ((state: { isActive: boolean }) => string)
  children?: ReactNode
}) {
  const pathname = usePathname()
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  return (
    <NextLink
      href={toHref(to)}
      aria-current={isActive ? 'page' : undefined}
      className={typeof className === 'function' ? className({ isActive }) : className}
      {...rest}
    >
      {children}
    </NextLink>
  )
}
