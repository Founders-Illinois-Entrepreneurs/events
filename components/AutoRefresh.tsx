'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-renders the page's server data every few seconds while the tab is visible.
// (Simple polling instead of websockets: plenty for a room of ~50 people.)
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
