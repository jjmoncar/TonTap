'use client'

import React from 'react'
import { 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  const colorConfig: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  }

  const fetchStats = async () => {
    setLoading(true)
    
    // Total Users
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Tasks Completed
    const { count: tasksCount } = await supabase
      .from('task_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COMPLETED')

    // TON Paid
    const { data: withdrawals } = await supabase
      .from('withdrawal_requests')
      .select('ton_amount')
      .eq('status', 'COMPLETED')
    
    const tonPaid = withdrawals?.reduce((sum: number, req: any) => sum + (Number(req.ton_amount) || 0), 0) || 0

    // Pending Withdrawals Count
    const { count: pendingCount } = await supabase
      .from('withdrawal_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')

    // Fraud Flags
    const { count: fraudCount } = await supabase
      .from('fraud_flags')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false)
      
    // Active Tasks
    const { count: activeTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')

    setStats([
      { label: 'Total Users', value: usersCount || 0, trend: '+New', icon: Users, color: 'emerald' },
      { label: 'Tasks Completed', value: tasksCount || 0, trend: '+Active', icon: CheckCircle2, color: 'blue' },
      { label: 'TON Paid', value: tonPaid.toFixed(2), trend: '+Sent', icon: Wallet, color: 'purple' },
      { label: 'Pending Withdrawals', value: pendingCount || 0, trend: 'Action Req', icon: ShieldAlert, color: 'amber' },
    ])

    setActions([
      { label: 'Pending Withdrawals', count: pendingCount || 0, priority: 'High', href: '/admin/withdrawals' },
      { label: 'Unresolved Alerts', count: fraudCount || 0, priority: 'Medium', href: '/admin/fraud-alerts' },
      { label: 'Active Tasks', count: activeTasks || 0, priority: 'Low', href: '/admin/tasks' },
    ])

    // Generate Chart Data (Last 12 Days)
    const days = 12
    const now = new Date()
    const pastDate = new Date()
    pastDate.setDate(now.getDate() - days)
    
    const { data: recentWithdrawals } = await supabase
      .from('withdrawal_requests')
      .select('ton_amount, requested_at')
      .gte('requested_at', pastDate.toISOString())
      .eq('status', 'COMPLETED')
      
    const { data: recentEarnings } = await supabase
      .from('point_transactions')
      .select('amount, created_at')
      .gte('created_at', pastDate.toISOString())
      .eq('type', 'EARNING')

    const chart = Array.from({ length: days }).map((_, i) => {
      const d = new Date()
      d.setDate(now.getDate() - (days - 1 - i))
      const dateStr = d.toISOString().split('T')[0]
      
      const dayWithdrawals = recentWithdrawals?.filter((w: any) => w.requested_at.startsWith(dateStr)) || []
      const payout = dayWithdrawals.reduce((sum: number, w: any) => sum + Number(w.ton_amount), 0)
      
      const dayEarnings = recentEarnings?.filter((e: any) => e.created_at.startsWith(dateStr)) || []
      const earn = dayEarnings.reduce((sum: number, e: any) => sum + (Number(e.amount) * 0.00001), 0)
      
      return { 
        label: d.getDate().toString(),
        earn: Math.max(earn, 0.05), // Add small baseline for visual
        payout: Math.max(payout, 0.02)
      }
    })
    
    const maxVal = Math.max(...chart.map(c => Math.max(c.earn, c.payout)))
    setChartData(chart.map(c => ({
      ...c,
      earnHeight: (c.earn / maxVal) * 100,
      payoutHeight: (c.payout / maxVal) * 100
    })))

    setLoading(false)
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Admin Dashboard</h1>
          <p className="text-slate-400">System metrics and business performance overview.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-slate-800 text-sm font-bold rounded-xl border border-slate-700 hover:bg-slate-700 transition-all">Export Report</button>
          <button onClick={fetchStats} className="px-4 py-2 bg-emerald-500 text-slate-950 text-sm font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">Refresh Data</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 hover:border-slate-700 transition-all group"
          >
            <div className="flex justify-between items-start">
              <div className={`w-12 h-12 ${colorConfig[stat.color]?.bg || 'bg-slate-500/10'} rounded-2xl flex items-center justify-center ${colorConfig[stat.color]?.text || 'text-slate-500'} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white mt-1">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white tracking-tight">Earnings vs. Payouts</h3>
            <select className="bg-slate-800 border-none rounded-lg text-xs font-bold p-2 outline-none">
              <option>Last 12 Days</option>
            </select>
          </div>
          
          <div className="h-64 w-full flex items-end gap-3 pb-2 pt-8">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full relative h-full flex flex-col justify-end">
                  {/* Earnings Bar (Background/Taller) */}
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${d.earnHeight}%` }}
                    transition={{ delay: i * 0.05, duration: 1 }}
                    className="w-full bg-emerald-500/20 group-hover:bg-emerald-500/40 transition-all rounded-t-lg absolute bottom-0"
                    title={`Earnings Equivalent: ${d.earn.toFixed(4)} TON`}
                  />
                  {/* Payouts Bar (Foreground) */}
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${d.payoutHeight}%` }}
                    transition={{ delay: i * 0.05 + 0.2, duration: 1 }}
                    className="w-full bg-emerald-500 rounded-t-lg shadow-[0_0_15px_rgba(16,185,129,0.3)] absolute bottom-0"
                    title={`Payouts: ${d.payout.toFixed(4)} TON`}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500/30"></div>
              <span className="text-xs text-slate-400 font-bold">Points Earned (TON Eqv)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              <span className="text-xs text-slate-400 font-bold">Actual TON Payouts</span>
            </div>
          </div>
        </div>

        {/* Sidebar: Pending Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white">Action Required</h3>
          </div>
          <div className="p-6 space-y-6 flex-1">
            {actions.map((action, i) => (
              <div 
                key={i} 
                onClick={() => router.push(action.href)}
                className="flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white group-hover:text-emerald-500 transition-colors">{action.label}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    action.priority === 'High' ? 'bg-red-500/10 text-red-500' :
                    action.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {action.priority} Priority
                  </span>
                </div>
                <div className="text-2xl font-bold text-white bg-slate-800 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700 group-hover:border-emerald-500 transition-all">
                  {action.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
