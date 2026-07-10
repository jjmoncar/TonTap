import { NextRequest } from 'next/server'
import { adminAuth } from './admin'

export async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.split('Bearer ')[1]
  try {
    const decodedToken = await adminAuth.verifyIdToken(token, true)
    return decodedToken
  } catch (error) {
    console.error('Error verifying token (maybe revoked or invalid):', error)
    return null
  }
}
