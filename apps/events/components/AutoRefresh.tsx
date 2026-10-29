'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-renders the page's server data every few seconds while the tab is visible.
// Skips a tick while offline (refreshing then would show the browser's
// "No internet" page) or while a form has unsaved changes (it sets
// window.__ftHoldRefresh).
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => {
      const held = (window as unknown as { __ftHoldRefresh?: boolean }).__ftHoldRefresh
      if (document.visibilityState === 'visible' && navigator.onLine && !held) router.refresh()
    }, seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
