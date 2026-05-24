import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // si hay un parámetro "next", lo usamos para la redirección final, si no, vamos al dashboard
  const next = searchParams.get('next') ?? '/dashboard'

  // Get the host from headers to ensure correct redirect, especially in development
  // where request.url might incorrectly resolve to 0.0.0.0
  const host = request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
  let baseUrl = host ? `${protocol}://${host}` : origin

  // Force localhost instead of 0.0.0.0 to avoid ERR_ADDRESS_INVALID
  if (baseUrl.includes('0.0.0.0')) {
    baseUrl = baseUrl.replace('0.0.0.0', 'localhost').replace('https://', 'http://')
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  // Si algo falla, lo devolvemos al login con un mensaje de error
  return NextResponse.redirect(`${baseUrl}/login?error=Could not authenticate user`)
}
