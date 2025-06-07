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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const EmailService_1 = require("./services/EmailService");
const RateLimiterCheck_1 = require("./utils/RateLimiterCheck");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const emailService = new EmailService_1.EmailService();
app.post('/send-email', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const emailRequest = req.body;
        // Basic validation
        if (!emailRequest.to || !emailRequest.subject || !emailRequest.body || !emailRequest.requestId) {
            res.status(400).json({
                error: 'Missing required fields: to, subject, body, requestId'
            });
            return;
        }
        // Check if any provider is available before attempting to send
        if (!emailService.isAnyProviderAvailable()) {
            res.status(503).json({
                error: 'Service temporarily unavailable',
                message: 'All email providers are currently unavailable due to circuit breaker protection',
                availableProvider: emailService.getBestAvailableProvider()
            });
            return;
        }
        const result = yield emailService.sendEmail(emailRequest);
        const statusCode = result.success ? 200 : 400;
        res.status(statusCode).json(result);
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}));
// Enhanced health check endpoint with circuit breaker status
app.get('/health', (_req, res) => {
    const serviceStatus = emailService.getServiceStatus();
    const isHealthy = emailService.isAnyProviderAvailable();
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'OK' : 'DEGRADED',
        service: serviceStatus,
        rateLimit: (0, RateLimiterCheck_1.getRateLimitStatus)(),
        availableProviders: emailService.getBestAvailableProvider() ? [emailService.getBestAvailableProvider()] : []
    });
});
// Circuit breaker status endpoint
app.get('/circuit-breakers', (_req, res) => {
    res.json({
        status: 'OK',
        circuitBreakers: emailService.getCircuitBreakerStatus()
    });
});
// Admin endpoint to reset circuit breakers
app.post('/admin/reset-circuit-breakers', (_req, res) => {
    try {
        emailService.resetCircuitBreakers();
        res.json({
            message: 'All circuit breakers have been reset',
            circuitBreakers: emailService.getCircuitBreakerStatus()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to reset circuit breakers',
            message: error.message
        });
    }
});
// Endpoint to check provider availability
app.get('/providers/status', (_req, res) => {
    res.json({
        anyProviderAvailable: emailService.isAnyProviderAvailable(),
        bestAvailableProvider: emailService.getBestAvailableProvider(),
        circuitBreakers: emailService.getCircuitBreakerStatus()
    });
});
app.listen(3000, () => {
    console.log(' Email Service running on port 3000');
    console.log(' POST /send-email - Send an email');
    console.log(' GET /health - Service status');
    console.log(' GET /circuit-breakers - Circuit breaker status');
    console.log(' POST /admin/reset-circuit-breakers - Reset circuit breakers');
    console.log(' GET /providers/status - Provider availability status');
});
