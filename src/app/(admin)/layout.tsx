'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { 
  LayoutDashboard, 
  ListTodo, 
  Users, 
  Wallet, 
  Settings, 
  ShieldAlert,
  ArrowLeft,
  Loader2
} from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const docRef = doc(db, 'users', user.uid)
        const docSnap = await getDoc(docRef)
        const profile = docSnap.exists() ? docSnap.data() : null

        if (profile?.role !== 'ADMIN') {
          router.push('/dashboard')
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error verifying admin status:', err)
        router.push('/dashboard')
      }
    })
    
    return () => unsubscribe()
  }, [])

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
    { name: 'Tasks', icon: ListTodo, href: '/admin/tasks' },
    { name: 'Users', icon: Users, href: '/admin/users' },
    { name: 'Withdrawals', icon: Wallet, href: '/admin/withdrawals' },
    { name: 'System Config', icon: Settings, href: '/admin/system-config' },
    { name: 'Fraud Alerts', icon: ShieldAlert, href: '/admin/fraud-alerts' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-emerald-500">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold tracking-widest uppercase">Verifying Credentials</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col fixed inset-y-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <span className="text-xl font-bold text-white">TonTap Admin</span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link 
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  isActive 
                    ? 'bg-white text-slate-950 shadow-lg' 
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="pt-6 border-t border-slate-800">
          <Link 
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 transition-all font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to User UI
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-10 bg-slate-950 min-h-screen">
        {children}
      </main>
    </div>
  )
}
