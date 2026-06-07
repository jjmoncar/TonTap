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
    const { amountPoints } = await request.json()

    // 0. Fetch dynamic system configurations
    const { data: configs } = await supabaseAdmin
      .from('system_config')
      .select('key, value')
      .in('key', ['ton_per_point', 'min_withdrawal_points', 'maintenance_mode'])

    const configMap = configs?.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value
      return acc
    }, {}) || {}

    if (configMap.maintenance_mode === 'true') {
      return NextResponse.json({ error: 'System is currently in maintenance mode. Try again later.' }, { status: 503 })
    }

    const MIN_WITHDRAWAL = Number(configMap.min_withdrawal_points || 10000)
    const TON_RATE = Number(configMap.ton_per_point || 0.00001)

    if (amountPoints < MIN_WITHDRAWAL) {
      return NextResponse.json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} points` }, { status: 400 })
    }

    // 1. Get current user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('total_points, ton_wallet')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (profile.total_points < amountPoints) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 })
    }

    if (!profile.ton_wallet) {
      return NextResponse.json({ error: 'TON wallet not configured' }, { status: 400 })
    }

    // 2. Create withdrawal request
    const tonAmount = amountPoints * TON_RATE 
    const { data: withdrawal, error: withdrawError } = await supabaseAdmin
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        points_amount: amountPoints,
        ton_amount: tonAmount,
        ton_rate: TON_RATE,
        ton_wallet: profile.ton_wallet,
        status: 'PENDING'
      })
      .select()
      .single()

    if (withdrawError) throw withdrawError

    // 3. Deduct points from user
    const newPoints = profile.total_points - amountPoints
    await supabaseAdmin
      .from('users')
      .update({ total_points: newPoints })
      .eq('id', user.id)

    // 4. Create transaction record
    await supabaseAdmin
      .from('point_transactions')
      .insert({
        user_id: user.id,
        amount: -amountPoints,
        type: 'WITHDRAW',
        balance_after: newPoints,
        reference_id: withdrawal.id,
        description: `Withdrawal request #${withdrawal.id.slice(0, 8)}`
      })

    return NextResponse.json({ 
      success: true, 
      withdrawal_id: withdrawal.id,
      new_total: newPoints
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
