import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Generar un nonce dinámico codificado en Base64
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  
  // Obtener el proyecto de Firebase desde las variables de entorno
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || ''
  const firebaseDomain = firebaseProjectId ? `https://${firebaseProjectId}.firebaseapp.com` : ''

  const isDev = process.env.NODE_ENV === 'development'

  // Definir las directivas CSP.
  // En desarrollo añadimos 'unsafe-eval' para habilitar Next.js Fast Refresh.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://www.google.com/ https://recaptcha.google.com/ ${firebaseDomain} https://*.firebaseapp.com;
    connect-src 'self' ${firebaseDomain} https://*.googleapis.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.google.com/recaptcha/ https://www.gstatic.com/;
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
