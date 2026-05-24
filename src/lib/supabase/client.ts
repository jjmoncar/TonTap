import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Evitamos retornar un objeto vacío que cause TypeErrors
    // Usamos placeholders si faltan las llaves para que los métodos existan
    console.warn('Supabase environment variables are missing!')
    return createBrowserClient(
      url || 'https://placeholder.supabase.co',
      key || 'placeholder'
    )
  }

  return createBrowserClient(url, key)
}
