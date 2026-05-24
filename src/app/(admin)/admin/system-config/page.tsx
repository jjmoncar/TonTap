'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Settings2, 
  Save, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SystemConfigPage() {
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .order('key', { ascending: true })
    
    if (data) setConfigs(data)
    setLoading(false)
  }

  const handleUpdate = async (key: string, newValue: string) => {
    setSaving(key)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/system-config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue })
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      
      setSuccessMsg(`Configuration '${key}' updated successfully.`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setSaving(null)
    }
  }

  const handleChange = (index: number, val: string) => {
    const newConfigs = [...configs]
    newConfigs[index].value = val
    setConfigs(newConfigs)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">System Configuration</h1>
          <p className="text-slate-400">Manage global platform settings and parameters.</p>
        </div>
        <button 
          onClick={fetchConfig}
          className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-white transition-all"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500"
          >
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-bold">{successMsg}</p>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500"
          >
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-bold">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {configs.map((config, idx) => (
          <motion.div 
            key={config.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 hover:border-slate-700 transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
                  <Settings2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-white font-bold font-mono text-sm">{config.key}</h3>
                  <p className="text-slate-400 text-sm mt-1">{config.description}</p>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Last updated: {new Date(config.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                {config.value === 'true' || config.value === 'false' ? (
                  <select 
                    value={config.value}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    className="flex-1 md:w-40 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500"
                  >
                    <option value="true">Enabled (True)</option>
                    <option value="false">Disabled (False)</option>
                  </select>
                ) : (
                  <input 
                    type="text"
                    value={config.value}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    className="flex-1 md:w-40 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-emerald-500"
                  />
                )}
                
                <button 
                  onClick={() => handleUpdate(config.key, config.value)}
                  disabled={saving === config.key}
                  className="p-3 bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 shrink-0"
                  title="Save Config"
                >
                  {saving === config.key ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
