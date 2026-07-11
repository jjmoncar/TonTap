'use client'

import React, { useState, useEffect } from 'react'
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Loader2,
  Ban,
  Filter
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export default function FraudAlertsPage() {
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('PENDING')

  useEffect(() => {
    fetchFlags()
  }, [])

  const fetchFlags = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'fraud_flags'), orderBy('created_at', 'desc'))
      const snap = await getDocs(q)
      const flagsArr = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data()
        let users = null
        if (data.user_id) {
          const uDoc = await getDoc(doc(db, 'users', data.user_id))
          if (uDoc.exists()) users = uDoc.data()
        }
        return { id: d.id, ...data, users }
      }))
      setFlags(flagsArr)
    } catch (err) {
      console.error('Failed to fetch fraud flags', err)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (flagId: string, resolved: boolean) => {
    setProcessing(flagId)
    try {
      const res = await fetch('/api/admin/fraud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId, resolved })
      })
      const result = await res.json()
      if (result.success) {
        await fetchFlags()
      } else {
        throw new Error(result.error)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessing(null)
    }
  }

  const handleBanUser = async (userId: string) => {
    if (!confirm('Are you sure you want to ban this user?')) return
    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'UPDATE_STATUS', payload: { status: 'BANNED' } })
      })
      const result = await res.json()
      if (result.success) {
        alert('User has been banned successfully.')
      } else {
        throw new Error(result.error)
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  const filteredFlags = flags.filter(f => {
    if (filter === 'PENDING') return !f.resolved
    if (filter === 'RESOLVED') return f.resolved
    return true
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Fraud Alerts</h1>
          <p className="text-slate-400">Monitor suspicious activities and protect the platform.</p>
        </div>
        
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
          {['ALL', 'PENDING', 'RESOLVED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                filter === f 
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Pending Alerts</p>
            <h3 className="text-3xl font-bold text-white mt-2">{flags.filter(f => !f.resolved).length}</h3>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Resolved</p>
            <h3 className="text-3xl font-bold text-white mt-2">{flags.filter(f => f.resolved).length}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {filteredFlags.map((flag, idx) => (
            <motion.div 
              key={flag.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-slate-900 border p-6 rounded-3xl flex flex-col md:flex-row gap-6 md:items-center justify-between transition-all ${
                flag.resolved ? 'border-slate-800 opacity-60' : 'border-red-500/30 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
              }`}
            >
              <div className="flex gap-4 items-start">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
                  flag.resolved ? 'bg-slate-800 text-slate-500' : 'bg-red-500/10 text-red-500'
                }`}>
                  {flag.resolved ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-widest ${
                      flag.resolved ? 'bg-slate-800 text-slate-400' : 'bg-red-500 text-white'
                    }`}>
                      {flag.reason}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(flag.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-lg mt-2">
                    {flag.users?.full_name || 'Unknown User'} 
                    <span className="text-slate-500 text-sm font-mono ml-2">({flag.users?.phone || 'No phone'})</span>
                  </h3>
                  {flag.details && (
                    <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-400 overflow-x-auto">
                      {JSON.stringify(flag.details, null, 2)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 border-t border-slate-800 pt-4 md:border-0 md:pt-0">
                {!flag.resolved && (
                  <button 
                    onClick={() => handleBanUser(flag.user_id)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    Ban User
                  </button>
                )}
                
                <button 
                  onClick={() => handleResolve(flag.id, !flag.resolved)}
                  disabled={processing === flag.id}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 ${
                    flag.resolved 
                      ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                  }`}
                >
                  {processing === flag.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : flag.resolved ? (
                    'Mark Unresolved'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Resolved
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
          {filteredFlags.length === 0 && (
            <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-700">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1">All Clear!</h3>
              <p className="text-slate-500 text-sm">No fraud alerts found for the selected filter.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
