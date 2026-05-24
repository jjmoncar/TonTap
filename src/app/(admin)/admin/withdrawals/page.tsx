'use client'

import React, { useState, useEffect } from 'react'
import { Wallet, CheckCircle2, XCircle, Clock, ExternalLink, Search, Loader2, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [txHash, setTxHash] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*, users(full_name, phone)')
      .order('requested_at', { ascending: false })
    
    if (data) setRequests(data)
    setLoading(false)
  }

  const handleApprove = async (id: string) => {
    if (!txHash) {
      alert('Please enter the TON transaction hash first.')
      return
    }

    setProcessing(id)
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ 
          status: 'COMPLETED', 
          tx_hash: txHash,
          processed_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      
      setTxHash('')
      setSelectedId(null)
      fetchRequests()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this request? Points will be returned to the user.')) return
    
    setProcessing(id)
    try {
      // 1. Get request details
      const { data: request, error: requestError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', id)
        .single()

      if (requestError) throw requestError;
      if (!request) throw new Error('Request not found');

      // 2. Return points to user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('total_points')
        .eq('id', request.user_id)
        .single()
      
      if (userError) throw userError;
      if (!user) throw new Error('User not found');

      const newPoints = user.total_points + request.points_amount;
      await supabase
        .from('users')
        .update({ total_points: newPoints })
        .eq('id', request.user_id)

      // 3. Mark request as rejected
      await supabase
        .from('withdrawal_requests')
        .update({ status: 'REJECTED' })
        .eq('id', id)

      // 4. Create refund transaction record
      await supabase
        .from('point_transactions')
        .insert({
          user_id: request.user_id,
          amount: request.points_amount,
          type: 'REFUND',
          balance_after: newPoints,
          reference_id: id,
          description: `Refund for rejected withdrawal #${id.slice(0, 8)}`
        })

      fetchRequests()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Withdrawal Requests</h1>
          <p className="text-slate-400">Review and process user payout requests.</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">TON Wallet</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/30 transition-all">
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-white">{req.users?.full_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{req.users?.phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-emerald-500">{req.ton_amount} TON</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{req.points_amount.toLocaleString()} pts</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-slate-400">{req.ton_wallet.slice(0, 8)}...{req.ton_wallet.slice(-8)}</p>
                      <button 
                        onClick={() => window.open(`https://tonviewer.com/${req.ton_wallet}`, '_blank')}
                        className="text-slate-600 hover:text-emerald-500 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                      req.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                      req.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {req.status === 'PENDING' && (
                      <div className="flex justify-end gap-2">
                        {selectedId === req.id ? (
                          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-700">
                            <input 
                              type="text"
                              placeholder="Transaction Hash"
                              value={txHash}
                              onChange={(e) => setTxHash(e.target.value)}
                              className="bg-transparent border-none outline-none text-xs text-white px-2 w-40"
                            />
                            <button 
                              onClick={() => handleApprove(req.id)}
                              disabled={processing === req.id}
                              className="p-2 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400"
                            >
                              {processing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setSelectedId(null)} className="p-2 text-slate-500">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => setSelectedId(req.id)}
                              className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleReject(req.id)}
                              className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {req.status === 'COMPLETED' && (
                      <button 
                        onClick={() => window.open(`https://tonviewer.com/transaction/${req.tx_hash}`, '_blank')}
                        className="text-xs font-bold text-slate-500 hover:text-emerald-500 flex items-center gap-1 ml-auto"
                      >
                        View TX <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No withdrawal requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
