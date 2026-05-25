'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Wallet, ArrowUpRight, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function DashboardOverview() {
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<any>({
    todayTasks: 0,
    taskLimit: 15,
    totalEarnedPoints: 0,
    tonPerPoint: 0.00001,
  })
  const [recommendedTasks, setRecommendedTasks] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch User Profile
      const { data: profileData } = await supabase
        .from('users')
        .select('total_points, full_name')
        .eq('id', user.id)
        .maybeSingle()
      setProfile(profileData)

      // 2. Fetch System Config
      const { data: configData } = await supabase
        .from('system_config')
        .select('key, value')
      
      const configMap: any = {}
      configData?.forEach(item => configMap[item.key] = item.value)
      
      const taskLimit = parseInt(configMap['daily_task_limit'] || '15')
      const tonPerPoint = parseFloat(configMap['ton_per_point'] || '0.00001')

      // 3. Fetch Today's Tasks Count
      const today = new Date().toISOString().split('T')[0]
      const { count: todayTasks } = await supabase
        .from('task_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'COMPLETED')
        .eq('session_date', today)

      // 4. Fetch Total Earned Points (sum of EARN transactions)
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'EARN')
      
      const totalEarnedPoints = transactions?.reduce((acc, curr) => acc + curr.amount, 0) || 0

      setStats({
        todayTasks: todayTasks || 0,
        taskLimit,
        totalEarnedPoints,
        tonPerPoint
      })

      // 5. Fetch Recommended Tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(4)
      setRecommendedTasks(tasksData || [])

      // 6. Fetch Recent Activities (combined transactions and withdrawals)
      const { data: recentTransactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      const formattedActivities = recentTransactions?.map(tx => ({
        id: tx.id,
        title: tx.description || (tx.type === 'EARN' ? 'Task Completed' : 'Transaction'),
        amount: `${tx.amount > 0 ? '+' : ''}${tx.amount} pts`,
        time: new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'success',
        type: tx.type.toLowerCase()
      })) || []

      setActivities(formattedActivities)
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
    </div>
  )

  const progressPercent = Math.min(100, Math.round((stats.todayTasks / stats.taskLimit) * 100))

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400">Track your progress and earnings in real-time.</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
          <Clock className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Daily Reset: <span className="text-slate-900 dark:text-white font-bold">00:00 UTC</span></span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Points Balance */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card bg-emerald-500 dark:bg-emerald-600 border-none relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-100 uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md">Balance</span>
            </div>
            <div>
              <h3 className="text-white text-4xl font-extrabold tracking-tight">
                {mounted ? (profile?.total_points?.toLocaleString() || 0) : '0'} <span className="text-emerald-100 text-lg font-normal">pts</span>
              </h3>
              <p className="text-emerald-50/70 text-sm font-medium mt-1">
                ≈ {( (profile?.total_points || 0) * stats.tonPerPoint ).toFixed(4)} TON
              </p>
            </div>
            <Link href="/dashboard/withdraw" className="w-full py-2.5 bg-white text-emerald-600 font-bold rounded-xl text-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20">
              Withdraw Funds
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Daily Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="premium-card flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Tasks</span>
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight">{stats.todayTasks} / {stats.taskLimit}</h3>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="bg-emerald-500 h-full rounded-full"
                  />
                </div>
                <span className="text-xs font-bold text-slate-500">{progressPercent}%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-500 font-bold">Real-time</span> progress update
          </p>
        </motion.div>

        {/* Total Earned */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="premium-card flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-500">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Earned</span>
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight">{(stats.totalEarnedPoints * stats.tonPerPoint).toFixed(2)} <span className="text-slate-400 text-lg font-normal tracking-normal">TON</span></h3>
              <p className="text-slate-500 text-sm font-medium mt-1">Lifetime rewards</p>
            </div>
          </div>
          <div className="flex items-center -space-x-2 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="user" />
              </div>
            ))}
            <span className="text-[10px] text-slate-400 font-bold ml-4">Join thousand earners</span>
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Tasks & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Recommended Tasks</h2>
            <Link href="/dashboard/tasks" className="text-sm font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1 transition-all group">
              View all
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendedTasks.length > 0 ? recommendedTasks.map((task, idx) => (
              <Link 
                key={task.id} 
                href={`/dashboard/tasks?start=${task.id}`} 
                onClick={() => window.open(task.url, '_blank')}
                className="premium-card flex flex-col gap-4 group cursor-pointer hover:border-emerald-500/50 dark:hover:border-emerald-500/50"
              >
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform`}>
                    <Clock className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{task.exposure_seconds} SEC</span>
                </div>
                <div>
                  <h4 className="text-slate-900 dark:text-white font-bold">{task.title}</h4>
                  <p className="text-slate-500 text-xs mt-1">High reward task</p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg">+{task.points_reward} <span className="text-xs font-normal text-slate-400">pts</span></span>
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )) : (
              <div className="col-span-2 text-center py-10 text-slate-500">No tasks available right now.</div>
            )}
          </div>
        </div>

        {/* Right Column: History & Alerts */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Activity Feed</h2>
          
          <div className="premium-card p-0 overflow-hidden">
            <div className="p-6 space-y-6">
              {activities.length > 0 ? activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${activity.status === 'success' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`}></div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{activity.title}</p>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">{activity.amount}</span>
                    </div>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center text-slate-500 text-xs py-4">No recent activity.</div>
              )}
            </div>
            <Link href="/dashboard/history" className="w-full py-4 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-emerald-500 transition-all border-t border-slate-100 dark:border-slate-800 block text-center">
              View Full History
            </Link>
          </div>


        </div>
      </div>
    </div>
  )
}
