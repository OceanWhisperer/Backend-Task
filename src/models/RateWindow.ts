export interface RateLimitWindow {
  timestamps: number[];
  windowSize: number; // in milliseconds
  maxRequests: number;
}