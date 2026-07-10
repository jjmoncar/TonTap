import { auth } from './client'

export async function authFetch(url: string, options: RequestInit = {}) {
  // Esperar a que Firebase inicialice la sesión si aún no está lista
  let currentUser = auth.currentUser
  if (!currentUser) {
    // Breve espera en caso de que esté cargando la sesión
    await new Promise<void>((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        currentUser = user
        unsubscribe()
        resolve()
      })
    })
  }

  const token = await currentUser?.getIdToken()
  
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  return fetch(url, { ...options, headers })
}
