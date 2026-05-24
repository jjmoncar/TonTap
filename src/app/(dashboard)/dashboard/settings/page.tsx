'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Wallet, Shield, Bell, Smartphone, Loader2, X, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    ton_wallet: ''
  })
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false)
  const [supportMessage, setSupportMessage] = useState('')
  const supabase = createClient()

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportMessage.trim()) return
    window.location.href = `mailto:jjmc081970@gmail.com?subject=Support Request&body=${encodeURIComponent(supportMessage)}`
    setIsSupportModalOpen(false)
    setSupportMessage('')
  }

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        setProfile(data)
        setFormData({
          full_name: data?.full_name || '',
          ton_wallet: data?.ton_wallet || ''
        })
      }
      setLoading(false)
    }
    fetchProfile()
  }, [supabase])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          ton_wallet: formData.ton_wallet
        })
        .eq('id', user.id)
      
      setProfile({ ...profile, ...formData })
      setIsEditing(false)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
    </div>
  )

  const sections = [
    {
      title: 'Profile Information',
      icon: User,
      fields: [
        { label: 'Full Name', value: profile?.full_name, icon: User, key: 'full_name' },
        { label: 'Phone Number', value: profile?.phone, icon: Smartphone },
        { label: 'TON Wallet', value: profile?.ton_wallet, icon: Wallet, key: 'ton_wallet' },
      ]
    },
    {
      title: 'Security & Privacy',
      icon: Shield,
      fields: [
        { label: 'Account Status', value: profile?.status || 'ACTIVE', icon: Shield },
        { label: 'User Role', value: profile?.role || 'USER', icon: Shield },
      ]
    }
  ]

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">Manage your account preferences and profile details.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {sections.map((section) => (
          <motion.div 
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card space-y-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-500">
                  <section.icon className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{section.title}</h2>
              </div>
              {section.title === 'Profile Information' && (
                <button 
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold text-slate-900 dark:text-white rounded-lg transition-all flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isEditing ? 'Save Changes' : 'Edit Profile'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {section.fields.map((field) => (
                <div key={field.label} className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                  <div className={`flex items-center gap-3 p-3 rounded-xl border ${isEditing && field.key ? 'bg-white dark:bg-slate-900 border-emerald-500/50 ring-2 ring-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'}`}>
                    <field.icon className={`w-4 h-4 ${isEditing && field.key ? 'text-emerald-500' : 'text-slate-400'}`} />
                    {isEditing && field.key ? (
                      <input 
                        type="text"
                        value={(formData as any)[field.key]}
                        onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                        className="bg-transparent border-none outline-none w-full text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400"
                        placeholder={`Enter ${field.label}`}
                      />
                    ) : (
                      <span className={`text-sm ${field.value ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-normal text-slate-400 italic'}`}>
                        {field.value || 'Not set'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        <div className="premium-card bg-slate-900 dark:bg-slate-800 border-none text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold">Need help with your account?</h3>
              <p className="text-slate-400 text-sm">Contact our support team for any technical issues or wallet inquiries.</p>
            </div>
            <button 
              onClick={() => setIsSupportModalOpen(true)}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 shrink-0"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSupportModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSupportModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Contact Support</h3>
                <button 
                  onClick={() => setIsSupportModalOpen(false)}
                  className="text-slate-400 hover:text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSupportSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="support-message" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    How can we help you?
                  </label>
                  <textarea
                    id="support-message"
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    className="w-full min-h-[120px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(false)}
                    className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!supportMessage.trim()}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
