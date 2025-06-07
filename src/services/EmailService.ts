import { EmailRequest } from "../models/EmailRequest";
import { EmailStatus } from "../models/EmailStatus";
import { SendGridProvider } from "../providers/SendGridProvider";
import { MailgunProvider } from "../providers/MailGunProvider";
import { isDuplicate, markAsSent } from "../utils/IdempotencyCheck";
import { isRateLimited } from "../utils/RateLimiterCheck";
import { CircuitBreaker} from "../utils/CircuitBreaker";

export class EmailService {
  private sendGridProvider: SendGridProvider;
  private mailgunProvider: MailgunProvider;
  private sendGridCircuitBreaker: CircuitBreaker;
  private mailgunCircuitBreaker: CircuitBreaker;
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second base delay

  constructor() {
    this.sendGridProvider = new SendGridProvider();
    this.mailgunProvider = new MailgunProvider();
    
    // Initialize circuit breakers for each provider
    this.sendGridCircuitBreaker = new CircuitBreaker('SendGrid', {
      failureThreshold: 3,    // Trip after 3 failures
      recoveryTimeout: 30000, // Wait 30 seconds before retry
      monitoringWindow: 60000 // Track failures in 60-second window
    });
    
    this.mailgunCircuitBreaker = new CircuitBreaker('Mailgun', {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      monitoringWindow: 60000
    });
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

    // Try primary provider (SendGrid) with circuit breaker protection
    let primaryResult = await this.attemptSendWithCircuitBreaker(
      this.sendGridProvider,
      this.sendGridCircuitBreaker,
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

    console.log(`[EmailService] Primary provider failed or blocked by circuit breaker, trying fallback...`);

    // Fallback to secondary provider (Mailgun) with circuit breaker protection
    let fallbackResult = await this.attemptSendWithCircuitBreaker(
      this.mailgunProvider,
      this.mailgunCircuitBreaker,
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

    // Both providers failed or are circuit-broken
    return {
      success: false,
      providerUsed: "Both providers failed or unavailable",
      attempts: primaryResult.attempts + fallbackResult.attempts,
      errorMessage: `Primary: ${primaryResult.errorMessage}, Fallback: ${fallbackResult.errorMessage}`,
      timestamp: startTime,
      requestId: emailRequest.requestId
    };
  }

  private async attemptSendWithCircuitBreaker(
    provider: SendGridProvider | MailgunProvider,
    circuitBreaker: CircuitBreaker,
    providerName: string,
    emailRequest: EmailRequest
  ): Promise<Omit<EmailStatus, 'timestamp' | 'requestId'>> {
    
    // Check if circuit breaker allows execution
    if (!circuitBreaker.canExecute()) {
      return {
        success: false,
        providerUsed: providerName,
        attempts: 0,
        errorMessage: `Circuit breaker is OPEN - ${providerName} temporarily unavailable`
      };
    }

    let attempts = 0;
    let lastError = "";

    for (let i = 0; i < this.maxRetries; i++) {
      attempts++;
      
      try {
        console.log(`[EmailService] Attempt ${attempts} with ${providerName}...`);
        await provider.sendEmail(emailRequest);
        
        // Record success with circuit breaker
        circuitBreaker.recordSuccess();
        
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

    // All retries failed - record failure with circuit breaker
    circuitBreaker.recordFailure();

    return {
      success: false,
      providerUsed: providerName,
      attempts: attempts,
      errorMessage: lastError
    };
  }

  private calculateExponentialBackoff(attemptNumber: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return this.baseDelay * Math.pow(2, attemptNumber);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Enhanced service status including circuit breaker states
  getServiceStatus() {
    return {
      providers: ['SendGrid', 'Mailgun'],
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay,
      circuitBreakers: {
        sendGrid: this.sendGridCircuitBreaker.getStatus(),
        mailgun: this.mailgunCircuitBreaker.getStatus()
      }
    };
  }

  // Method to manually reset circuit breakers (useful for admin operations)
  resetCircuitBreakers(): void {
    console.log('[EmailService] Manually resetting all circuit breakers');
    this.sendGridCircuitBreaker.reset();
    this.mailgunCircuitBreaker.reset();
  }

  // Method to get detailed circuit breaker status
  getCircuitBreakerStatus() {
    return {
      sendGrid: this.sendGridCircuitBreaker.getStatus(),
      mailgun: this.mailgunCircuitBreaker.getStatus()
    };
  }

  // Method to check if any provider is available
  isAnyProviderAvailable(): boolean {
    return this.sendGridCircuitBreaker.canExecute() || this.mailgunCircuitBreaker.canExecute();
  }

  // Method to get the best available provider
  getBestAvailableProvider(): string | null {
    if (this.sendGridCircuitBreaker.canExecute()) {
      return 'SendGrid';
    }
    if (this.mailgunCircuitBreaker.canExecute()) {
      return 'Mailgun';
    }
    return null;
  }
}