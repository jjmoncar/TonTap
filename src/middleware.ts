import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Obtener el proyecto de Firebase desde las variables de entorno
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || ''
  const firebaseDomain = firebaseProjectId ? `https://${firebaseProjectId}.firebaseapp.com` : ''


  // Definir las directivas CSP.
  // Permitimos 'unsafe-inline' y los orígenes necesarios de Next.js y Firebase
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.google.com https://www.gstatic.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://api.dicebear.com https://*.googleusercontent.com;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://www.google.com/ https://recaptcha.google.com/ ${firebaseDomain} https://*.firebaseapp.com;
    connect-src 'self' ${firebaseDomain} https://*.googleapis.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.google.com/recaptcha/ https://www.gstatic.com/;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()

  const requestHeaders = new Headers(request.headers)
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
