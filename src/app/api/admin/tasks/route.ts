import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase admin client
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
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert([{ ...payload, is_active: true }])
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating task:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const supabaseAdmin = getSupabaseAdmin()
    
    if (!payload.id) {
      return NextResponse.json({ success: false, error: 'Missing task ID' }, { status: 400 })
    }

    const { id, ...updateData } = payload

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating task:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing task ID' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
