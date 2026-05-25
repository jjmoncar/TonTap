import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Generar un nonce dinámico codificado en Base64
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  
  // Obtener el dominio de Supabase desde las variables de entorno
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).origin : 'https://*.supabase.co'

  // Definir las directivas CSP.
  // Eliminamos 'unsafe-inline' de script-src y usamos el nonce + 'strict-dynamic'.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://www.google.com/ https://recaptcha.google.com/;
    connect-src 'self' ${supabaseDomain} https://*.supabase.co wss://*.supabase.co https://www.google.com/recaptcha/ https://www.gstatic.com/;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  
  response.headers.set('Content-Security-Policy', cspHeader)
  return response
}

export const config = {
  matcher: [
    // Aplicar a todas las páginas excepto APIs, estáticos de Next.js, imágenes y favicon
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
