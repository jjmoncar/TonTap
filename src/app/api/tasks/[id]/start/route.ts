import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

// Cliente con service_role — NUNCA exponer en frontend
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Solo disponible en servidor
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id: taskId } = await params
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? ''

    // Verificar que la tarea existe y está activa
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, is_active')
      .eq('id', taskId)
      .eq('is_active', true)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 })
    }

    // El constraint UNIQUE(user_id, task_id, session_date) en DB previene duplicados
    // Si ya existe una sesión hoy, el INSERT falla y retornamos error apropiado
    const { data: session, error: insertError } = await supabaseAdmin
      .from('task_sessions')
      .insert({
        user_id: user.id,    // Viene del JWT, nunca del cliente
        task_id: taskId,
        ip_address: ip,
        user_agent: userAgent,
        // started_at se pone por DEFAULT NOW() en la DB — el cliente no lo controla
      })
      .select('id, started_at')
      .single()

    if (insertError?.code === '23505') { // Unique violation
      return NextResponse.json({ success: false, error: 'Ya iniciaste esta tarea hoy' }, { status: 409 })
    }

    if (insertError) {
      console.error('Insert session error:', insertError)
      return NextResponse.json({ success: false, error: 'Error al iniciar tarea' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessionId: session.id })

  } catch (err: any) {
    console.error('Unexpected error in start task:', err)
    return NextResponse.json({ success: false, error: err.message || 'Error interno' }, { status: 500 })
  }
}
