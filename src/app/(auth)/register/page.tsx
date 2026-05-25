'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, ArrowRight, UserPlus, Check, X } from 'lucide-react'
import { motion } from 'framer-motion'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Real-time validation checks
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)
  const passwordsMatch = password && password === confirmPassword

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // Enforce validations upon submission
    if (!hasMinLength) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (!hasUppercase) {
      setError('Password must contain at least one uppercase letter.')
      return
    }
    if (!hasSpecial) {
      setError('Password must contain at least one special character.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // After signup, redirect to onboarding
      router.push('/onboarding')
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Right Side (Image/Preview) - Flipped for variety */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full -ml-48 -mt-48 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full -mr-48 -mb-48 blur-3xl"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-6"
        >
          <div className="w-24 h-24 bg-emerald-500 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20">
            <UserPlus className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white">Join the Community</h2>
            <p className="text-slate-400 max-w-sm mx-auto">Start earning Toncoin by completing simple daily tasks. Secure, fast, and transparent.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl">
              <h4 className="text-emerald-400 text-2xl font-bold">15-20</h4>
              <p className="text-slate-400 text-sm">Daily Tasks</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl">
              <h4 className="text-emerald-400 text-2xl font-bold">10k</h4>
              <p className="text-slate-400 text-sm">Min. Withdrawal</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Left Side (Form) */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white dark:bg-slate-900">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Create an account</h1>
            <p className="text-slate-500 dark:text-slate-400">Join TonTap and start earning today.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                  required
                />
              </div>
              
              {/* Real-time validation indicators */}
              <div className="pt-1.5 space-y-1 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[10px]">
                  {hasMinLength ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                  )}
                  <span className={hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}>
                    Min. 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {hasUppercase ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                  )}
                  <span className={hasUppercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}>
                    Min. 1 uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {hasSpecial ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-1 mr-1" />
                  )}
                  <span className={hasSpecial ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}>
                    1 special character
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                  required
                />
              </div>
              {confirmPassword && (
                <div className="flex items-center gap-1.5 text-[10px] pl-1">
                  {passwordsMatch ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span className={passwordsMatch ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-500 dark:text-red-400"}>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                {error}
              </p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Creating account...' : 'Create Account'}
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-600 hover:text-emerald-500 font-semibold">Sign in</Link>
          </p>

          <p className="text-[10px] text-center text-slate-400 mt-8">
            By signing up, you agree to our <Link href="#" className="underline">Terms of Service</Link> and <Link href="#" className="underline">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
