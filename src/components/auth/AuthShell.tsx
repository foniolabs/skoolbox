import type { ReactNode } from 'react'
import { BookOpen, GraduationCap, WifiOff } from 'lucide-react'
import logo from '../../assets/logo.svg'

const points = [
  { icon: GraduationCap, text: 'Teach whole lessons with Martha, your AI tutor' },
  { icon: BookOpen, text: 'Nigerian curriculum from Primary 5 to SS3' },
  { icon: WifiOff, text: 'Built for classrooms with little or no internet' },
]

/** Two-panel frame for sign in and sign up; the brand panel hides on small screens. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg-app">
      <aside className="hidden w-[44%] max-w-xl flex-col justify-between bg-primary-dark p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <img src={logo.src} alt="" className="h-10 w-auto rounded-lg bg-white p-1" />
          <span className="text-xl font-bold tracking-tight">SkoolBox</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Every lesson, ready when you are.
          </h1>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-5 w-5 text-accent-light" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">Made in Jos for Nigerian schools.</p>
      </aside>
      <main className="flex flex-1 items-center justify-center p-4">{children}</main>
    </div>
  )
}
