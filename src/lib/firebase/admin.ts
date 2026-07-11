import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  try {
    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n').replace(/"/g, ''),
        }),
      })
    } else {
      console.warn('Firebase Admin credentials are missing! Using default local developer initialization.')
      initializeApp({
        projectId: projectId || 'mock-project',
      })
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error)
    // Fallback in case of credential parsing error
    initializeApp({
      projectId: projectId || 'mock-project',
    })
  }
}

const adminDb = getFirestore()
const adminAuth = getAuth()

const admin = {
  firestore: {
    FieldValue
  }
}

export { adminDb, adminAuth, admin }
