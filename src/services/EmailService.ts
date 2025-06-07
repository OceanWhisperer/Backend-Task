import { EmailRequest } from "../models/EmailRequest";
import { EmailStatus } from "../models/EmailStatus";
import { SendGridProvider } from "../providers/SendGridProvider";
import { MailgunProvider } from "../providers/MailGunProvider";
import { isDuplicate, markAsSent } from "../utils/IdempotencyCheck";
import { isRateLimited} from "../utils/RateLimiterCheck";

export class EmailService {
  private sendGridProvider: SendGridProvider;
  private mailgunProvider: MailgunProvider;
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second base delay

  constructor() {
    this.sendGridProvider = new SendGridProvider();
    this.mailgunProvider = new MailgunProvider();
  }

  async sendEmail(emailRequest: EmailRequest): Promise<EmailStatus> {
    const startTime = Date.now();
    
    // Check idempotency
    if (isDuplicate(emailRequest.requestId)) {
      return {
        success: false,
        attempts: 0,
        errorMessage: "Duplicate request - email already sent",
        timestamp: startTime,
        requestId: emailRequest.requestId
      };
    }

    // Check rate limiting
    if (isRateLimited()) {
      return {
        success: false,
        attempts: 0,
        errorMessage: "Rate limit exceeded - please try again later",
        timestamp: startTime,
        requestId: emailRequest.requestId
      };
    }

    // Try primary provider (SendGrid) with retries
    let primaryResult = await this.attemptSendWithRetries(
      this.sendGridProvider,
      "SendGrid",
      emailRequest
    );

    if (primaryResult.success) {
      markAsSent(emailRequest.requestId);
      return {
        ...primaryResult,
        timestamp: startTime,
        requestId: emailRequest.requestId
      };
    }

    console.log(`[EmailService] Primary provider failed, falling back to secondary...`);

    // Fallback to secondary provider (Mailgun) with retries
    let fallbackResult = await this.attemptSendWithRetries(
      this.mailgunProvider,
      "Mailgun",
      emailRequest
    );

    if (fallbackResult.success) {
      markAsSent(emailRequest.requestId);
      return {
        ...fallbackResult,
        timestamp: startTime,
        requestId: emailRequest.requestId
      };
    }

    // Both providers failed
    return {
      success: false,
      providerUsed: "Both providers failed",
      attempts: primaryResult.attempts + fallbackResult.attempts,
      errorMessage: `Primary: ${primaryResult.errorMessage}, Fallback: ${fallbackResult.errorMessage}`,
      timestamp: startTime,
      requestId: emailRequest.requestId
    };
  }

  private async attemptSendWithRetries(
    provider: SendGridProvider | MailgunProvider,
    providerName: string,
    emailRequest: EmailRequest
  ): Promise<Omit<EmailStatus, 'timestamp' | 'requestId'>> {
    let attempts = 0;
    let lastError = "";

    for (let i = 0; i < this.maxRetries; i++) {
      attempts++;
      
      try {
        console.log(`[EmailService] Attempt ${attempts} with ${providerName}...`);
        await provider.sendEmail(emailRequest);
        
        return {
          success: true,
          providerUsed: providerName,
          attempts: attempts
        };
      } catch (error) {
        lastError = (error as Error).message;
        console.log(`[EmailService] ${providerName} attempt ${attempts} failed: ${lastError}`);
        
        // Don't wait after the last attempt
        if (i < this.maxRetries - 1) {
          const delay = this.calculateExponentialBackoff(i);
          console.log(`[EmailService] Waiting ${delay}ms before retry...`);
          await this.delay(delay);
        }
      }
    }

    return {
      success: false,
      providerUsed: providerName,
      attempts: attempts,
      errorMessage: lastError
    };
  }

  private calculateExponentialBackoff(attemptNumber: number): number {
    // Exponential backoff. Delays 1s, 2s, 4s, 8s...
    return this.baseDelay * Math.pow(2, attemptNumber);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to get service status
  getServiceStatus() {
    return {
      providers: ['SendGrid', 'Mailgun'],
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay
    };
  }
}