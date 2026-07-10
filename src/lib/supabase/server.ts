export const createClient = async () => {
  console.warn('Supabase server client is deprecated and stubbed.')
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  } as any
}
