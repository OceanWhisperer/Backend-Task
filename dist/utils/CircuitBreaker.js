"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN"; // allow only 1 for test
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(providerName, config) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.nextAttemptTime = 0;
        this.providerName = providerName;
        this.config = Object.assign({ failureThreshold: 3, recoveryTimeout: 30000, monitoringWindow: 60000 }, config);
    }
    // Check for allowing a request
    canExecute() {
        const now = Date.now();
        switch (this.state) {
            case CircuitState.CLOSED:
                // always allow since closed circuit
                return true;
            case CircuitState.OPEN:
                // check for if half open is feasable
                if (now >= this.nextAttemptTime) {
                    console.log(`[CircuitBreaker] ${this.providerName}: Moving to HALF_OPEN state`);
                    this.state = CircuitState.HALF_OPEN;
                    return true;
                }
                // block out the request
                console.log(`[CircuitBreaker] ${this.providerName}: Circuit OPEN - blocking request`);
                return false;
            case CircuitState.HALF_OPEN:
                // testing by allowing one request
                console.log(`[CircuitBreaker] ${this.providerName}: HALF_OPEN - allowing test request`);
                return true;
            default:
                return false;
        }
    }
    recordSuccess() {
        console.log(`[CircuitBreaker] ${this.providerName}: Success recorded`);
        this.failureCount = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            console.log(`[CircuitBreaker] ${this.providerName}: Test successful - closing circuit`);
            this.state = CircuitState.CLOSED;
        }
    }
    recordFailure() {
        const now = Date.now();
        // Reset failure count
        if (now - this.lastFailureTime > this.config.monitoringWindow) {
            this.failureCount = 0;
        }
        this.failureCount++;
        this.lastFailureTime = now;
        console.log(`[CircuitBreaker] ${this.providerName}: Failure ${this.failureCount}/${this.config.failureThreshold}`);
        // Trip the circuit on threshold
        if (this.failureCount >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.nextAttemptTime = now + this.config.recoveryTimeout;
            console.log(`[CircuitBreaker] ${this.providerName}: Circuit OPENED! Next attempt at: ${new Date(this.nextAttemptTime).toISOString()}`);
        }
        // After Halfopen state retrun to Open
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
            this.nextAttemptTime = now + this.config.recoveryTimeout;
            console.log(`[CircuitBreaker] ${this.providerName}: Test failed - circuit back to OPEN`);
        }
    }
    // current status for monitoring
    getStatus() {
        return {
            providerName: this.providerName,
            state: this.state,
            failureCount: this.failureCount,
            nextAttemptTime: this.state === CircuitState.OPEN ? new Date(this.nextAttemptTime).toISOString() : null,
            config: this.config
        };
    }
    // Reset circuit breaker to initial state
    reset() {
        console.log(`[CircuitBreaker] ${this.providerName}: Manual reset`);
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.nextAttemptTime = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
