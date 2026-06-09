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
    // 1. Autenticar usuario via JWT (Supabase verifica el token)
    const supabase = await createSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { captchaToken, sessionId } = await req.json()
    const resolvedParams = await params
    const taskId = resolvedParams.id

    // 2. Verificar CAPTCHA con Google (servidor a servidor)
    const captchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY!,
        response: captchaToken,
        remoteip: req.headers.get('x-forwarded-for') ?? '',
      }),
    })
    const { success: captchaOk } = await captchaRes.json()
    
    if (!captchaOk) {
      return NextResponse.json({ error: 'CAPTCHA inválido' }, { status: 400 })
    }

    // 3. Llamar función atómica en DB via service_role
    // TODA la lógica de validación está en la función de Postgres
    // El cliente nunca controla puntos, tiempo ni balance
    const { data, error } = await supabaseAdmin.rpc('complete_task_secure', {
      p_user_id: user.id,
      p_task_id: taskId,
      p_session_id: sessionId,
    })

    if (error) {
      console.error('DB error:', error)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json(data)

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
