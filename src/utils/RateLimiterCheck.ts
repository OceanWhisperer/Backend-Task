import { RateLimitWindow } from "../models/RateWindow";

const rateLimitWindow: RateLimitWindow = {
  timestamps: [],
  windowSize: 60 * 1000,
  maxRequests: 10
};

// checks if a call is going to get rate limited
export function isRateLimited(): boolean {
    const now = Date.now();
    rateLimitWindow.timestamps = rateLimitWindow.timestamps.filter(
    timestamp => now - timestamp < rateLimitWindow.windowSize
  ); // filtering outdated timestamnps from the array
   if (rateLimitWindow.timestamps.length >= rateLimitWindow.maxRequests) {
    return true; // block request since limit exceeded max
  }
  rateLimitWindow.timestamps.push(now);
  return false;

}

// gives t he current status of requests in a minute
export function getRateLimitStatus() {
  const now = Date.now();
  const activeRequests = rateLimitWindow.timestamps.filter(
    timestamp => now - timestamp < rateLimitWindow.windowSize
  ).length;
  
  return {
    currentRequests: activeRequests,
    maxRequests: rateLimitWindow.maxRequests,
    windowSize: rateLimitWindow.windowSize
  };
}

