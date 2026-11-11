'use client'

import { useEffect, useState } from 'react'
import { isTauri } from '../../lib/tauri/commands'

/** Web-only notice: there is no backend yet, so nothing here is real or saved. */
export default function DemoBanner() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || isTauri) return null
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
      Demo with sample data. Nothing you change is saved, and the AI tutor needs the{' '}
      <a href="https://skoolbox.xyz/#download" className="font-semibold underline">
        desktop app
      </a>
      .
    </div>
  )
}
