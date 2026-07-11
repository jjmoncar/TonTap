import { NextRequest } from 'next/server';
import { rateLimiter } from './rateLimit';
import { RateLimitError } from './errors';
import { admin, adminDb } from '../firebase/admin';
import { verifyUser } from '../firebase/serverAuth';
import { logger } from '../logger';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

/**
 * Higher Order Function to apply rate limiting to a Next.js route handler.
 * Applies limits per IP address and per User ID (if authenticated).
 * Logs abusers to Firestore.
 */
export function withRateLimit(
  handler: (req: NextRequest, ...args: any[]) => Promise<any>,
  config: RateLimitConfig
) {
  return async (req: NextRequest, ...args: any[]) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown_ip';
    const path = req.nextUrl?.pathname || req.url || 'unknown path';
    
    // Check IP limit
    const ipKey = `ip_${ip}_${path}`;
    const ipAllowed = rateLimiter.check(ipKey, config.limit, config.windowMs);

    if (!ipAllowed) {
      logger.warn('Rate limit exceeded by IP', { ip, path });
      await logAbuse(ip, null, path, 'IP_RATE_LIMIT_EXCEEDED');
      throw new RateLimitError();
    }

    // Try to get User ID for user-level rate limiting
    let userId = null;
    try {
      const decodedToken = await verifyUser(req);
      if (decodedToken) {
        userId = decodedToken.uid;
      }
    } catch (e) {
      // Ignore auth errors here, they will be handled by the route handler
    }

    if (userId) {
      const userKey = `user_${userId}_${path}`;
      const userAllowed = rateLimiter.check(userKey, config.limit, config.windowMs);

      if (!userAllowed) {
        logger.warn('Rate limit exceeded by User', { userId, ip, path });
        await logAbuse(ip, userId, path, 'USER_RATE_LIMIT_EXCEEDED');
        throw new RateLimitError();
      }
    }

    return handler(req, ...args);
  };
}

async function logAbuse(ip: string, userId: string | null, path: string, reason: string) {
  try {
    await adminDb.collection('abuse_logs').add({
      ip,
      userId,
      path,
      reason,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error('Failed to log abuse to Firestore', error, { ip, userId, path });
  }
}
