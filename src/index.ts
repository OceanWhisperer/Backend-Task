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
      return; // ← Explicit return here
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

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'OK',
    service: emailService.getServiceStatus(),
    rateLimit: getRateLimitStatus()
  });
});

app.listen(3000, () => {
  console.log('✅ Email Service running on port 3000');
  console.log('📧 POST /send-email - Send an email');
  console.log('🏥 GET /health - Service status');
});