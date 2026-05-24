import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { taskId, sessionId, captchaToken } = await request.json()

    if (!taskId || !sessionId || !captchaToken) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 })
    }

    // Verify reCAPTCHA
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify'
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY
    
    if (!recaptchaSecret) {
      console.error('Missing RECAPTCHA_SECRET_KEY environment variable')
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${recaptchaSecret}&response=${captchaToken}`
    })
    
    const recaptchaResult = await verifyResponse.json()
    if (!recaptchaResult.success) {
      return NextResponse.json({ success: false, error: 'Invalid CAPTCHA' }, { status: 400 })
    }

    // Initialize Supabase admin client to bypass RLS for secure updates
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('task_sessions')
      .select('*, tasks(exposure_seconds, points_reward)')
      .eq('id', sessionId)
      .eq('task_id', taskId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Task already completed' }, { status: 400 })
    }

    // Verify time exposure
    const elapsedMs = Date.now() - new Date(session.started_at).getTime()
    const requiredMs = (session.tasks?.exposure_seconds || 30) * 1000

    // Allow a small 2-second grace period for network latency
    if (elapsedMs < requiredMs - 2000) {
      return NextResponse.json({ success: false, error: 'Exposure time not met' }, { status: 400 })
    }

    // Verify user profile exists
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .select('total_points')
      .eq('id', session.user_id)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const pointsReward = session.tasks?.points_reward || 0
    const newTotalPoints = userProfile.total_points + pointsReward

    // 1. Update User Points
    const { error: updatePointsError } = await supabaseAdmin
      .from('users')
      .update({ total_points: newTotalPoints })
      .eq('id', session.user_id)

    if (updatePointsError) throw updatePointsError

    // 2. Mark Session as Completed
    const { error: updateSessionError } = await supabaseAdmin
      .from('task_sessions')
      .update({ 
        status: 'COMPLETED', 
        completed_at: new Date().toISOString(),
        captcha_valid: true
      })
      .eq('id', sessionId)

    if (updateSessionError) throw updateSessionError

    // 3. Create Point Transaction Record
    await supabaseAdmin
      .from('point_transactions')
      .insert({
        user_id: session.user_id,
        type: 'EARN',
        amount: pointsReward,
        balance_after: newTotalPoints,
        reference_id: sessionId,
        description: `Completed task: ${taskId}`
      })

    return NextResponse.json({ success: true, newTotalPoints })
  } catch (error: any) {
    console.error('Error completing task:', error)
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 })
  }
}
