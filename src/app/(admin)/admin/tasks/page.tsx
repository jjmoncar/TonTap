'use client'

import React, { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit2, Trash2, ExternalLink, 
  Clock, Coins, X, Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { fetchWithAuth } from '@/lib/api/client'
export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [exposure, setExposure] = useState(30)
  const [points, setPoints] = useState(100)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'tasks'), orderBy('created_at', 'desc'))
      const snap = await getDocs(q)
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const openNewModal = () => {
    setEditingId(null)
    setTitle('')
    setUrl('')
    setExposure(30)
    setPoints(100)
    setIsModalOpen(true)
  }

  const openEditModal = (task: any) => {
    setEditingId(task.id)
    setTitle(task.title)
    setUrl(task.url)
    setExposure(task.exposure_seconds)
    setPoints(task.points_reward)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      title,
      url,
      exposure_seconds: exposure,
      points_reward: points
    }

    try {
      let res;
      if (editingId) {
        res = await fetchWithAuth('/api/admin/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload })
        })
      } else {
        res = await fetchWithAuth('/api/admin/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      
      const text = await res.text()
      let json
      try {
        json = JSON.parse(text)
      } catch (e) {
        throw new Error(`Server returned an invalid response (Status ${res.status}): ${text.slice(0, 50)}...`)
      }
      
      if (!res.ok || !json.success) {
        const errMsg = typeof json.error === 'string' ? json.error : json.error?.message || 'Failed to save task'
        throw new Error(errMsg)
      }
      
      setIsModalOpen(false)
    } catch (error: any) {
      console.error('Error saving task:', error)
      alert(error.message || 'Error saving task')
    }

    setSaving(false)
    fetchTasks()
  }

  const toggleStatus = async (task: any) => {
    try {
      await fetchWithAuth('/api/admin/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, is_active: !task.is_active })
      })
      fetchTasks()
    } catch (error) {
      console.error('Error toggling status:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this task? This cannot be undone.')) {
      try {
        await fetch(`/api/admin/tasks?id=${id}`, { method: 'DELETE' })
        fetchTasks()
      } catch (error) {
        console.error('Error deleting task:', error)
      }
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Task Management</h1>
          <p className="text-slate-400">Create and configure the advertising tasks for users.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-slate-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Create New Task
        </button>
      </div>

      {/* Task Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Title & Link</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Exposure</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Reward</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-800/30 transition-all group">
                    <td className="px-6 py-6">
                      <div className="space-y-1">
                        <p className="font-bold text-white group-hover:text-emerald-500 transition-colors">{task.title}</p>
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{task.url}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-bold text-white">{task.exposure_seconds}s</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Coins className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-500">+{task.points_reward}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <button onClick={() => toggleStatus(task)} className="transition-all hover:scale-110">
                        {task.is_active ? (
                          <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full text-[10px] font-bold mx-auto w-fit">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            ACTIVE
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-500 bg-slate-500/10 px-3 py-1 rounded-full text-[10px] font-bold mx-auto w-fit">
                            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                            INACTIVE
                          </div>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(task)} className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(task.id)} className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                   <tr>
                     <td colSpan={5} className="text-center py-10 text-slate-500">No tasks found. Create one to get started.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Task' : 'Create New Task'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Task Title</label>
                    <input 
                      required
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Watch Ad #1 - High Conversion"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Adsterra Direct Link URL</label>
                    <input 
                      required
                      type="url" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Exposure (seconds)</label>
                      <input 
                        required
                        type="number" 
                        min="5"
                        value={exposure}
                        onChange={(e) => setExposure(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Points Reward</label>
                      <input 
                        required
                        type="number" 
                        min="1"
                        value={points}
                        onChange={(e) => setPoints(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-500 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingId ? 'Save Changes' : 'Create Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
