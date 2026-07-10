interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 60000) {
    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    
    // Ensure the interval doesn't keep the Node.js event loop alive unnecessarily
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Checks and increments the rate limit for a given key.
   * @param key Unique identifier (e.g., IP address or User ID)
   * @param limit Maximum allowed requests within the window
   * @param windowMs Time window in milliseconds
   * @returns true if the request is allowed, false if rate limit exceeded
   */
  public check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      // Create new or reset expired entry
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, entry);
      return true;
    }

    if (entry.count >= limit) {
      return false; // Rate limit exceeded
    }

    entry.count += 1;
    this.store.set(key, entry);
    return true;
  }
}

// Export a singleton instance
export const rateLimiter = new InMemoryRateLimiter();
