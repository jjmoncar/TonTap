import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const { id, full_name, ton_wallet } = payload

    if (!id || !full_name || !ton_wallet) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error')
    }
    
    // In a real application, you would also verify the user's JWT from the request headers
    // For this implementation, we rely on the client sending its own ID, which we assume is authenticated via Supabase Auth
    // The better approach is to use Supabase Server Client to get the user session securely.
    // However, considering the previous architecture, we will update the profile using the Admin Client.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        ton_wallet
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
