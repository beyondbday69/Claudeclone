/**
 * A utility to handle API rate limits (e.g., NVIDIA's 40 RPM limit).
 * It tracks request timestamps and sleeps if the limit is reached.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  /**
   * @param limit The maximum number of requests allowed within the window (e.g., 40)
   * @param windowMs The time window in milliseconds (e.g., 60000 for 1 minute)
   */
  constructor(limit: number = 40, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /**
   * Call this before making an API request.
   * If the limit is reached, it will pause (sleep) until a slot is available.
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    // Clean up timestamps older than the window (1 minute)
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.limit) {
      // Calculate how long to sleep until the oldest request expires
      const oldestRequestTime = this.timestamps[0];
      const timeToWait = this.windowMs - (now - oldestRequestTime);

      console.warn(`[RateLimiter] Limit reached (${this.limit} req/min). Sleeping for ${Math.ceil(timeToWait / 1000)}s...`);
      await sleep(timeToWait);

      // Check again after waking up
      return this.throttle();
    }

    this.timestamps.push(Date.now());
  }
}

/**
 * A simple sleep function to pause execution for a given number of milliseconds.
 * Useful if you want to manually catch a 429 error and wait.
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
