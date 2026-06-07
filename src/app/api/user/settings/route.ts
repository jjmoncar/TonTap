import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const { full_name, ton_wallet } = payload

    if (!full_name || !ton_wallet) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error')
    }
    
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        ton_wallet
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
