'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    let settled = false

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        settled = true
        if (user) {
          router.replace('/dashboard')
        } else {
          router.replace('/login')
        }
      },
      (error) => {
        settled = true
        console.error('onAuthStateChanged error:', error)
        router.replace('/login')
      }
    )

    // Fallback: if Firebase never resolves in 6s, redirect to login
    const timeout = setTimeout(() => {
      if (!settled) {
        console.warn('Firebase auth timed out — redirecting to /login')
        router.replace('/login')
      }
    }, 6000)

    return () => {
      unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-emerald-500 rounded-xl"></div>
        <p className="text-slate-500 font-medium">Loading TonTap...</p>
      </div>
    </div>
  )
}
