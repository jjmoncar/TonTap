'use client'

import React, { useState, useEffect } from 'react'
import { 
  ListTodo, 
  LayoutGrid, 
  List as ListIcon, 
  Search, 
  Filter, 
  Clock, 
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReCAPTCHA from 'react-google-recaptcha'
import { createClient } from '@/lib/supabase/client'

export default function TasksPage() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [activeTask, setActiveTask] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (activeTask && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (timeLeft === 0 && activeTask) {
      // Timer finished
    }
    return () => clearInterval(timer)
  }, [activeTask, timeLeft])

  const fetchTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get all active tasks
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_active', true)

    // Get user's completed sessions for today
    const today = new Date().toISOString().split('T')[0]
    const { data: completedSessions } = await supabase
      .from('task_sessions')
      .select('task_id')
      .eq('user_id', user?.id)
      .eq('status', 'COMPLETED')
      .gte('completed_at', today)

    const completedIds = completedSessions?.map(s => s.task_id) || []

    const processedTasks = allTasks?.map(t => ({
      ...t,
      status: completedIds.includes(t.id) ? 'COMPLETED' : 'IN_PROGRESS'
    })) || []

    setTasks(processedTasks)
    setLoading(false)
  }

  const handleStartTask = async (task: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Check if a session already exists for today to prevent unique constraint errors
    const today = new Date().toISOString().split('T')[0]
    let { data: existingSession } = await supabase
      .from('task_sessions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('task_id', task.id)
      .eq('session_date', today)
      .single()

    let sessionId = existingSession?.id

    if (!existingSession) {
      // Create new session if none exists
      const { data: newSession, error: insertError } = await supabase
        .from('task_sessions')
        .insert({
          user_id: user.id,
          task_id: task.id,
          status: 'IN_PROGRESS'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error starting task:', insertError)
        return
      }
      sessionId = newSession.id
    } else if (existingSession.status === 'COMPLETED') {
      alert('You have already completed this task today.')
      return
    }

    setCurrentSessionId(sessionId)
    setActiveTask(task)
    setTimeLeft(task.exposure_seconds || 30)
    
    // 2. Open ad URL
    window.open(task.url, '_blank')
  }

  const handleVerify = async () => {
    if (!captchaToken) {
      alert('Please complete the CAPTCHA first.')
      return
    }

    setVerifying(true)
    try {
      const response = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeTask.id,
          sessionId: currentSessionId,
          captchaToken
        })
      })

      const result = await response.json()
      if (result.success) {
        setActiveTask(null)
        fetchTasks() // Refresh list
      } else {
        alert(result.error || 'Verification failed')
      }
    } catch (error) {
      console.error('Error verifying task:', error)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Available Tasks</h1>
          <p className="text-slate-500 dark:text-slate-400">Complete these tasks to earn points.</p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <button 
            onClick={() => setView('board')}
            className={`p-2 rounded-xl transition-all ${view === 'board' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setView('list')}
            className={`p-2 rounded-xl transition-all ${view === 'list' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ListIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all border border-slate-200 dark:border-slate-700">
            <Filter className="w-4 h-4" />
            Category
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all border border-slate-200 dark:border-slate-700">
            Points
          </button>
        </div>
      </div>

      {/* Task Views */}
      <AnimatePresence mode="wait">
        {view === 'board' ? (
          <motion.div 
            key="board"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`premium-card group relative ${task.status === 'COMPLETED' ? 'opacity-70 bg-slate-50 dark:bg-slate-900' : ''}`}
              >
                {task.status === 'COMPLETED' && (
                  <div className="absolute top-4 right-4 z-10 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                )}
                
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-500">
                      <Clock className="w-6 h-6" />
                    </div>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                      {task.category}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">{task.title}</h3>
                    <p className="text-slate-500 text-sm">Exposure time: <span className="font-bold text-slate-700 dark:text-slate-300">{task.exposure_seconds}s</span></p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Reward</span>
                      <span className="text-emerald-500 font-extrabold text-xl">+{task.points_reward} <span className="text-xs font-normal text-slate-400 tracking-normal uppercase">pts</span></span>
                    </div>
                    <button 
                      onClick={() => handleStartTask(task)}
                      disabled={task.status === 'COMPLETED'}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        task.status === 'COMPLETED' 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white shadow-lg hover:shadow-emerald-500/20'
                      }`}
                    >
                      {task.status === 'COMPLETED' ? 'Claimed' : 'Start Task'}
                      {task.status !== 'COMPLETED' && <ArrowUpRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Task Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Duration</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Reward</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => (
                  <tr key={task.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                          <ListTodo className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">{task.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{task.exposure_seconds} seconds</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                        {task.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-emerald-500 font-bold">+{task.points_reward} pts</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleStartTask(task)}
                        disabled={task.status === 'COMPLETED'}
                        className={`p-2 rounded-lg transition-all ${
                          task.status === 'COMPLETED'
                            ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                            : 'text-slate-400 hover:bg-emerald-500 hover:text-white'
                        }`}
                      >
                        {task.status === 'COMPLETED' ? <ShieldCheck className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Session Modal (Active State) */}
      <AnimatePresence>
        {activeTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative z-10 border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8 space-y-8 text-center">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Task in Progress</h2>
                  <p className="text-slate-500 text-sm">Please stay on the opened page for at least {activeTask.time} seconds.</p>
                </div>

                <div className="relative w-40 h-40 mx-auto">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle className="text-slate-100 dark:text-slate-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
                    <motion.circle 
                      className="text-emerald-500 stroke-current" 
                      strokeWidth="8" 
                      strokeLinecap="round" 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      fill="transparent"
                      initial={{ pathLength: 1 }}
                      animate={{ pathLength: timeLeft / (activeTask.exposure_seconds || 30) }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tighter">
                      00:{timeLeft.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4 items-center">
                  {timeLeft === 0 && (
                    <div className="w-full flex justify-center py-2 overflow-hidden">
                      <ReCAPTCHA
                        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''}
                        onChange={(token) => setCaptchaToken(token)}
                        theme="light"
                      />
                    </div>
                  )}
                  
                  <button 
                    onClick={handleVerify}
                    disabled={timeLeft > 0 || verifying || (!captchaToken && timeLeft === 0)} 
                    className="w-full py-4 bg-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {verifying ? 'Verifying...' : timeLeft > 0 ? `Wait ${timeLeft}s to Verify` : 'Verify Completion'}
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => {
                      setActiveTask(null)
                      setCaptchaToken(null)
                    }}
                    className="w-full py-3 text-slate-500 hover:text-red-500 transition-colors font-bold text-sm"
                  >
                    Cancel Task
                  </button>
                </div>

                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 text-left">
                  <AlertCircle className="w-8 h-8 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                    Closing the ad page before the timer ends will invalidate your session and you won't earn points.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
