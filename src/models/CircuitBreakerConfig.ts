export interface CircuitBreakerConfig {
  failureThreshold: number;    // total failures before tripping
  recoveryTimeout: number;     // time to wait before testing again 
  monitoringWindow: number;    // Time window to track failures
}