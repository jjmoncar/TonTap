import { auth } from '@/lib/firebase/client';

/**
 * A wrapper around `fetch` that automatically injects the Firebase Auth token
 * into the Authorization header.
 * 
 * If the user is not logged in, it throws an error.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User is not authenticated. Please log in.');
  }

  // Get the current token. Pass true if we need to force refresh (optional).
  const token = await currentUser.getIdToken();

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  
  // Also set Content-Type to JSON by default if we have a body and it's not set
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const newOptions: RequestInit = {
    ...options,
    headers,
  };

  return fetch(url, newOptions);
}
