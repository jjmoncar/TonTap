'use client'

import React, { useState, useEffect } from 'react'
import { 
  Wallet, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Info,
  Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function WithdrawPage() {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const [tonRate, setTonRate] = useState(0.00001)
  const [minWithdraw, setMinWithdraw] = useState(10000)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Get system config
      const { data: configs } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['ton_per_point', 'min_withdrawal_points'])
        
      if (configs) {
        const tr = configs.find(c => c.key === 'ton_per_point')?.value
        const mw = configs.find(c => c.key === 'min_withdrawal_points')?.value
        if (tr) setTonRate(Number(tr))
        if (mw) setMinWithdraw(Number(mw))
      }

      // Get user points and wallet
      const { data: profileData } = await supabase
        .from('users')
        .select('total_points, ton_wallet')
        .eq('id', user.id)
        .single()
      
      setProfile(profileData)

      // Get withdrawal history
      const { data: historyData } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
      
      setHistory(historyData || [])
    }
    setFetching(false)
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/withdraw/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPoints: Number(amount) })
      })

      const result = await response.json()
      if (result.success) {
        setSuccess(true)
        setAmount('')
        fetchData() // Refresh balance and history
      } else {
        setError(result.error || 'Withdrawal failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const tonEquivalent = (Number(amount) * tonRate).toFixed(6)

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Withdraw Funds</h1>
        <p className="text-slate-500 dark:text-slate-400">Convert your points to Toncoin and withdraw to your wallet.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-3 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="premium-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <form onSubmit={handleWithdraw} className="space-y-8">
              <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Available Balance</p>
                    <p className="text-xl font-extrabold text-slate-900 dark:text-white">{(profile?.total_points || 0).toLocaleString()} <span className="text-sm font-normal text-slate-400 uppercase">pts</span></p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equivalent</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{((profile?.total_points || 0) * tonRate).toFixed(4)} TON</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount to Withdraw</label>
                    <button 
                      type="button"
                      onClick={() => setAmount(profile?.total_points.toString())}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-500"
                    >
                      Use Max
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter points (min. 10,000)"
                      className="w-full pl-6 pr-24 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-slate-400 uppercase tracking-widest text-xs">
                      POINTS
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center">
                      <ArrowRight className="w-3 h-3 text-emerald-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-500">You will receive</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-500">{amount ? tonEquivalent : '0.000000'} TON</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Destination Wallet</label>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-mono text-slate-500 break-all">{profile?.ton_wallet || 'Not configured'}</span>
                  {profile?.ton_wallet && <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md uppercase tracking-wider">Verified</span>}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading || Number(amount) < minWithdraw || Number(amount) > (profile?.total_points || 0) || !profile?.ton_wallet}
                className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {loading ? 'Processing Request...' : 'Confirm Withdrawal'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Right Column: Info & History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card bg-slate-900 text-white border-none space-y-4">
            <h4 className="flex items-center gap-2 font-bold text-emerald-400">
              <Info className="w-5 h-5" />
              Withdrawal Rules
            </h4>
            <ul className="space-y-3">
              {[
                'Requests are processed within 24-48 hours.',
                'The conversion rate is fixed at the time of request.',
                'Only verified TON wallets can receive funds.',
                'Multi-account manipulation leads to account ban.'
              ].map((rule, i) => (
                <li key={i} className="flex gap-3 text-xs text-slate-400 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Recent Requests</h3>
            <div className="space-y-3">
              {history.map((req, i) => (
                <div key={i} className="premium-card p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${req.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                      {req.status === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{req.ton_amount} TON</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{req.points_amount.toLocaleString()} PTS • {new Date(req.requested_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                      req.status === 'COMPLETED' ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'
                    }`}>
                      {req.status}
                    </span>
                    {req.status === 'COMPLETED' && (
                      <button className="text-[10px] font-bold text-slate-400 hover:text-emerald-500 flex items-center gap-1 mt-1">
                        View TX <ExternalLink className="w-2 h-2" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {history.length === 0 && !fetching && (
                <p className="text-center text-slate-500 text-sm py-4">No withdrawal history yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {success && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
              onClick={() => setSuccess(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Request Submitted!</h2>
                <p className="text-slate-500 text-sm">Your withdrawal of {tonEquivalent} TON is now being processed by our team.</p>
              </div>
              <button 
                onClick={() => setSuccess(false)}
                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:bg-slate-800 transition-all"
              >
                Great, thanks!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
