'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { User, Phone, Wallet, Globe, ArrowRight, CheckCircle2, ChevronDown, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { COUNTRIES } from '@/lib/countries'

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    ton_wallet: '',
    country: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isCountryOpen, setIsCountryOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login')
        return
      }
      
      setUser(currentUser)

      // Fetch existing data to see where to start
      try {
        const docRef = doc(db, 'users', currentUser.uid)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const profile = docSnap.data()
          setFormData({
            full_name: profile.fullName || '',
            phone: profile.phone || '',
            ton_wallet: profile.tonWallet || '',
            country: profile.country || '',
          })

          // Logic to determine which step to show - EXTREMELY EXPLICIT
          const isStep1Complete = profile.fullName?.trim().length > 0 && profile.country?.trim().length > 0;
          const isStep2Complete = profile.tonWallet?.trim().length > 0 && profile.phone?.trim().length > 0;

          if (isStep1Complete && isStep2Complete) {
            router.push('/dashboard')
          } else if (isStep1Complete) {
            setStep(2)
          } else {
            setStep(1)
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    })
    return () => unsubscribe()
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error('No authenticated user found')

      const docRef = doc(db, 'users', currentUser.uid)
      await setDoc(docRef, {
        fullName: formData.full_name,
        phone: formData.phone,
        tonWallet: formData.ton_wallet,
        country: formData.country,
        updatedAt: serverTimestamp(),
      }, { merge: true })

      setStep(3) // Success step
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving your profile.')
      setLoading(false)
    }
  }

  const nextStep = async () => {
    if (step === 1 && formData.full_name && formData.country) {
      setLoading(true)
      const currentUser = auth.currentUser
      if (!currentUser) {
        setError('No user found.')
        setLoading(false)
        return
      }

      try {
        const docRef = doc(db, 'users', currentUser.uid)
        await setDoc(docRef, {
          fullName: formData.full_name.trim(),
          country: formData.country.trim(),
          role: 'USER',
          totalPoints: 0,
          status: 'ACTIVE',
          isFlagged: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
        
        setStep(2)
      } catch (err: any) {
        console.error('Error saving step 1:', err)
        setError('Error saving step 1. Please try again.')
      } finally {
        setLoading(false)
      }
    }
  }

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const selectedCountryName = COUNTRIES.find(c => c.code === formData.country)?.name || ''

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {/* Progress Bar */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {[1, 2, 3].map((s) => (
            <div 
              key={s}
              className={`h-2 w-16 rounded-full transition-all duration-500 ${
                step >= s ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="premium-card overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Tell us about yourself</h2>
                  <p className="text-slate-500 text-sm">We need some basic info to get you started.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleInputChange}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium">Country</label>
                    <div 
                      className="relative cursor-pointer"
                      onClick={() => setIsCountryOpen(!isCountryOpen)}
                    >
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <div className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 flex items-center justify-between">
                        <span className={formData.country ? "text-slate-900 dark:text-white" : "text-slate-500"}>
                          {formData.country ? selectedCountryName : "Select Country"}
                        </span>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isCountryOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
                        >
                          <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="text"
                              placeholder="Search country..."
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filteredCountries.length > 0 ? (
                              filteredCountries.map(country => (
                                <div 
                                  key={country.code}
                                  onClick={() => {
                                    setFormData({ ...formData, country: country.code })
                                    setIsCountryOpen(false)
                                    setCountrySearch('')
                                  }}
                                  className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between ${formData.country === country.code ? 'text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50/50 dark:bg-emerald-900/20' : 'text-slate-700 dark:text-slate-300'}`}
                                >
                                  {country.name}
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-slate-500 text-center">No countries found</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    nextStep();
                  }}
                  disabled={!formData.full_name || !formData.country || loading}
                  className="w-full py-3 px-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Saving...' : 'Continue'}
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Verification & Wallet</h2>
                  <p className="text-slate-500 text-sm">Where should we send your Toncoin?</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+1 234 567 890"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">TON Wallet Address</label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="text"
                        name="ton_wallet"
                        value={formData.ton_wallet}
                        onChange={handleInputChange}
                        placeholder="UQ... or EQ..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">Make sure this address is correct. You can't change it easily later.</p>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={loading || !formData.phone || !formData.ton_wallet}
                    className="flex-[2] py-3 px-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? 'Saving...' : 'Finish Setup'}
                    {!loading && <CheckCircle2 className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 space-y-6"
              >
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">You're all set!</h2>
                  <p className="text-slate-500">Redirecting you to your dashboard...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
