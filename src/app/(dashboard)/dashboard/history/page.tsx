'use client'

import React, { useState, useEffect } from 'react'

import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Coins,
  Wallet,
  Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { auth, db } from '@/lib/firebase/client'
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'
type Tab = 'tasks' | 'points' | 'withdrawals'

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    tasks: [] as any[],
    points: [] as any[],
    withdrawals: [] as any[]
  })

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchHistory(user)
      } else {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const fetchHistory = async (user: any) => {
    try {
      // Fetch Task History
      const qTasks = query(collection(db, 'task_sessions'), where('userId', '==', user.uid))
      const snapTasks = await getDocs(qTasks)
      const tasks = await Promise.all(snapTasks.docs.map(async d => {
        const data = d.data()
        let taskDetails = null
        if (data.taskId) {
           const tDoc = await getDoc(doc(db, 'tasks', data.taskId))
           if (tDoc.exists()) taskDetails = tDoc.data()
        }
        return { id: d.id, ...data, tasks: taskDetails, created_at: data.startedAt?.toDate() || new Date() }
      }))
      tasks.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

      // Fetch Points History
      const qPoints = query(collection(db, 'point_transactions'), where('userId', '==', user.uid))
      const snapPoints = await getDocs(qPoints)
      const points = snapPoints.docs.map(d => {
         const data = d.data()
         return { id: d.id, ...data, created_at: data.createdAt?.toDate() || new Date() }
      })
      points.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

      // Fetch Withdrawals History
      const qWithdrawals = query(collection(db, 'withdrawal_requests'), where('user_id', '==', user.uid))
      const snapWithdrawals = await getDocs(qWithdrawals)
      const withdrawals = snapWithdrawals.docs.map(d => {
         const data = d.data()
         return { id: d.id, ...data, requested_at: data.requested_at?.toDate() || new Date() }
      })
      withdrawals.sort((a, b) => b.requested_at.getTime() - a.requested_at.getTime())

      setData({ tasks, points, withdrawals })
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const tabs = [
    { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
    { id: 'points', label: 'Points', icon: Coins },
    { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Activity History</h1>
          <p className="text-slate-500 dark:text-slate-400">View your past tasks, points movements, and withdrawals.</p>
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <AnimatePresence mode="wait">
          {activeTab === 'tasks' && (
            <motion.div 
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="overflow-x-auto"
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date & Time</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Task Title</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Points</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.tasks.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {new Date(row.created_at).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{row.tasks?.title}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${row.status === 'COMPLETED' ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {row.status === 'COMPLETED' ? `+${row.tasks?.points_reward || 0}` : '0'} pts
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                          row.status === 'COMPLETED' ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.tasks.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No task history found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          )}

          {activeTab === 'points' && (
            <motion.div 
              key="points"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="overflow-x-auto"
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.points.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                          row.type === 'EARNING' ? 'text-emerald-500 bg-emerald-50' : 
                          row.type === 'WITHDRAWAL' ? 'text-amber-500 bg-amber-50' : 'text-blue-500 bg-blue-50'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{row.description}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 font-bold">
                          {row.amount > 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : <ArrowDownLeft className="w-3 h-3 text-amber-500" />}
                          <span className={row.amount > 0 ? 'text-emerald-500' : 'text-amber-500'}>
                            {row.amount > 0 ? `+${row.amount}` : row.amount}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">---</td>
                    </tr>
                  ))}
                  {data.points.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No point transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          )}

          {activeTab === 'withdrawals' && (
            <motion.div 
              key="withdrawals"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="overflow-x-auto"
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Requested At</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">TON Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Wallet</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.withdrawals.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">
                        {new Date(row.requested_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{row.ton_amount} TON</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{row.ton_wallet}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                          row.status === 'COMPLETED' ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {row.tx_hash ? (
                          <button className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline">
                            {row.tx_hash.slice(0, 8)}... <ArrowUpRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">---</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.withdrawals.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No withdrawal requests found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
        <AlertCircle className="w-5 h-5 text-slate-400" />
        <p className="text-xs text-slate-500 font-medium">Showing only the last 30 days of activity. For older records, please contact support.</p>
      </div>
    </div>
  )
}
