"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const SendGridProvider_1 = require("../providers/SendGridProvider");
const MailGunProvider_1 = require("../providers/MailGunProvider");
const IdempotencyCheck_1 = require("../utils/IdempotencyCheck");
const RateLimiterCheck_1 = require("../utils/RateLimiterCheck");
const CircuitBreaker_1 = require("../utils/CircuitBreaker");
class EmailService {
    constructor() {
        this.maxRetries = 3;
        this.baseDelay = 1000; // 1 second base delay
        this.sendGridProvider = new SendGridProvider_1.SendGridProvider();
        this.mailgunProvider = new MailGunProvider_1.MailgunProvider();
        // Initialize circuit breakers for each provider
        this.sendGridCircuitBreaker = new CircuitBreaker_1.CircuitBreaker('SendGrid', {
            failureThreshold: 3, // Trip after 3 failures
            recoveryTimeout: 30000, // Wait 30 seconds before retry
            monitoringWindow: 60000 // Track failures in 60-second window
        });
        this.mailgunCircuitBreaker = new CircuitBreaker_1.CircuitBreaker('Mailgun', {
            failureThreshold: 3,
            recoveryTimeout: 30000,
            monitoringWindow: 60000
        });
    }
    sendEmail(emailRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            // Check idempotency
            if ((0, IdempotencyCheck_1.isDuplicate)(emailRequest.requestId)) {
                return {
                    success: false,
                    attempts: 0,
                    errorMessage: "Duplicate request - email already sent",
                    timestamp: startTime,
                    requestId: emailRequest.requestId
                };
            }
            // Check rate limiting
            if ((0, RateLimiterCheck_1.isRateLimited)()) {
                return {
                    success: false,
                    attempts: 0,
                    errorMessage: "Rate limit exceeded - please try again later",
                    timestamp: startTime,
                    requestId: emailRequest.requestId
                };
            }
            // Try primary provider (SendGrid) with circuit breaker protection
            let primaryResult = yield this.attemptSendWithCircuitBreaker(this.sendGridProvider, this.sendGridCircuitBreaker, "SendGrid", emailRequest);
            if (primaryResult.success) {
                (0, IdempotencyCheck_1.markAsSent)(emailRequest.requestId);
                return Object.assign(Object.assign({}, primaryResult), { timestamp: startTime, requestId: emailRequest.requestId });
            }
            console.log(`[EmailService] Primary provider failed or blocked by circuit breaker, trying fallback...`);
            // Fallback to secondary provider (Mailgun) with circuit breaker protection
            let fallbackResult = yield this.attemptSendWithCircuitBreaker(this.mailgunProvider, this.mailgunCircuitBreaker, "Mailgun", emailRequest);
            if (fallbackResult.success) {
                (0, IdempotencyCheck_1.markAsSent)(emailRequest.requestId);
                return Object.assign(Object.assign({}, fallbackResult), { timestamp: startTime, requestId: emailRequest.requestId });
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
        });
    }
    attemptSendWithCircuitBreaker(provider, circuitBreaker, providerName, emailRequest) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    yield provider.sendEmail(emailRequest);
                    // Record success with circuit breaker
                    circuitBreaker.recordSuccess();
                    return {
                        success: true,
                        providerUsed: providerName,
                        attempts: attempts
                    };
                }
                catch (error) {
                    lastError = error.message;
                    console.log(`[EmailService] ${providerName} attempt ${attempts} failed: ${lastError}`);
                    // Don't wait after the last attempt
                    if (i < this.maxRetries - 1) {
                        const delay = this.calculateExponentialBackoff(i);
                        console.log(`[EmailService] Waiting ${delay}ms before retry...`);
                        yield this.delay(delay);
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
        });
    }
    calculateExponentialBackoff(attemptNumber) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        return this.baseDelay * Math.pow(2, attemptNumber);
    }
    delay(ms) {
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
    resetCircuitBreakers() {
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
    isAnyProviderAvailable() {
        return this.sendGridCircuitBreaker.canExecute() || this.mailgunCircuitBreaker.canExecute();
    }
    // Method to get the best available provider
    getBestAvailableProvider() {
        if (this.sendGridCircuitBreaker.canExecute()) {
            return 'SendGrid';
        }
        if (this.mailgunCircuitBreaker.canExecute()) {
            return 'Mailgun';
        }
        return null;
    }
}
exports.EmailService = EmailService;
