import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { taskId, userId } = await request.json()

    if (!taskId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify task exists and is active
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, is_active')
      .eq('id', taskId)
      .single()

    if (taskError || !task || !task.is_active) {
      return NextResponse.json({ success: false, error: 'Task is invalid or inactive' }, { status: 400 })
    }

    // Check if session already exists for today
    const today = new Date().toISOString().split('T')[0]
    const { data: existingSession, error: checkError } = await supabaseAdmin
      .from('task_sessions')
      .select('id, status')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .eq('session_date', today)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is expected if no session exists
      throw checkError
    }

    if (existingSession) {
      if (existingSession.status === 'COMPLETED') {
        return NextResponse.json({ success: false, error: 'Task already completed today' }, { status: 400 })
      }
      // Return existing session ID if IN_PROGRESS
      return NextResponse.json({ success: true, sessionId: existingSession.id })
    }

    // Create new session
    const { data: newSession, error: insertError } = await supabaseAdmin
      .from('task_sessions')
      .insert({
        user_id: userId,
        task_id: taskId,
        status: 'IN_PROGRESS'
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ success: true, sessionId: newSession.id })
  } catch (error: any) {
    console.error('Error starting task:', error)
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 })
  }
}
