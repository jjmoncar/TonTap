'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    console.log("Initializing auth listener with auth:", auth)
    const unsubscribe = onAuthStateChanged(
      auth, 
      (user) => {
        console.log("onAuthStateChanged fired! User is:", user)
        if (user) {
          window.location.replace('/dashboard')
        } else {
          window.location.replace('/login')
        }
      },
      (error) => {
        console.error("onAuthStateChanged error:", error)
      }
    )
    return () => unsubscribe()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-emerald-500 rounded-xl"></div>
        <p className="text-slate-500 font-medium">Loading TonTap...</p>
      </div>
    </div>
  )
}
