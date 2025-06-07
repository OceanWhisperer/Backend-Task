import express, { Request, Response } from 'express';
import { EmailRequest } from './models/EmailRequest';
import { EmailService } from './services/EmailService';
import { getRateLimitStatus } from './utils/RateLimiterCheck';

const app = express();
app.use(express.json());

const emailService = new EmailService();

app.post('/send-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const emailRequest: EmailRequest = req.body;
    
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

    const result = await emailService.sendEmail(emailRequest);
    
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
});

// Enhanced health check endpoint with circuit breaker status
app.get('/health', (_req: Request, res: Response): void => {
  const serviceStatus = emailService.getServiceStatus();
  const isHealthy = emailService.isAnyProviderAvailable();
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'DEGRADED',
    service: serviceStatus,
    rateLimit: getRateLimitStatus(),
    availableProviders: emailService.getBestAvailableProvider() ? [emailService.getBestAvailableProvider()] : []
  });
});

// Circuit breaker status endpoint
app.get('/circuit-breakers', (_req: Request, res: Response): void => {
  res.json({
    status: 'OK',
    circuitBreakers: emailService.getCircuitBreakerStatus()
  });
});

// Admin endpoint to reset circuit breakers
app.post('/admin/reset-circuit-breakers', (_req: Request, res: Response): void => {
  try {
    emailService.resetCircuitBreakers();
    res.json({
      message: 'All circuit breakers have been reset',
      circuitBreakers: emailService.getCircuitBreakerStatus()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset circuit breakers',
      message: (error as Error).message
    });
  }
});

// Endpoint to check provider availability
app.get('/providers/status', (_req: Request, res: Response): void => {
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