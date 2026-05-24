import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey)

  try {
    // Verify requester is admin
    const { data: requesterProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (requesterProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 })
    }

    const { userId, action, payload } = await request.json()
    
    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (action === 'UPDATE_STATUS') {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: payload.status })
        .eq('id', userId)
      if (error) throw error
    } 
    else if (action === 'UPDATE_ROLE') {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ role: payload.role })
        .eq('id', userId)
      if (error) throw error
    }
    else if (action === 'ADJUST_POINTS') {
      const { amount, description } = payload
      
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from('users')
        .select('total_points')
        .eq('id', userId)
        .single()
        
      if (userError || !targetUser) throw new Error('User not found')
      
      const newBalance = targetUser.total_points + Number(amount)
      
      // Update points
      await supabaseAdmin
        .from('users')
        .update({ total_points: newBalance })
        .eq('id', userId)
        
      // Log transaction
      await supabaseAdmin
        .from('point_transactions')
        .insert({
          user_id: userId,
          amount: Number(amount),
          type: Number(amount) > 0 ? 'EARNING' : 'DEDUCTION',
          balance_after: newBalance,
          description: description || `Admin adjustment by ${user.id.slice(0,8)}`
        })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
