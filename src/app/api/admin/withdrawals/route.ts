import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Server configuration error')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { action, id, txHash } = payload

    if (!id || !action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Get request details
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (withdrawalError || !withdrawal) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Request is already processed' }, { status: 400 })
    }

    if (action === 'APPROVE') {
      if (!txHash) {
        return NextResponse.json({ success: false, error: 'Missing transaction hash' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('withdrawal_requests')
        .update({ 
          status: 'COMPLETED', 
          tx_hash: txHash,
          processed_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
    } else if (action === 'REJECT') {
      // 2. Return points to user
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('total_points')
        .eq('id', withdrawal.user_id)
        .single()
      
      if (userError || !user) throw new Error('User not found')

      const newPoints = user.total_points + withdrawal.points_amount
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ total_points: newPoints })
        .eq('id', withdrawal.user_id)
        
      if (updateError) throw updateError

      // 3. Mark request as rejected
      const { error: rejectError } = await supabaseAdmin
        .from('withdrawal_requests')
        .update({ status: 'REJECTED', processed_at: new Date().toISOString() })
        .eq('id', id)
        
      if (rejectError) throw rejectError

      // 4. Create refund transaction record
      await supabaseAdmin
        .from('point_transactions')
        .insert({
          user_id: withdrawal.user_id,
          amount: withdrawal.points_amount,
          type: 'REFUND',
          balance_after: newPoints,
          reference_id: id,
          description: `Refund for rejected withdrawal #${id.slice(0, 8)}`
        })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error processing withdrawal:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
