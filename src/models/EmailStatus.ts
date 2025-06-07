export interface EmailStatus {
  success: boolean;
  providerUsed?: string;
  attempts: number;
  errorMessage?: string;
  timestamp: number;
  requestId: string;
}