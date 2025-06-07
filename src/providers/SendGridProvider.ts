// A sample email provider that returns success / failure
// Primary Provider

import { EmailRequest } from "../models/EmailRequest";

export class SendGridProvider {
  async sendEmail(email: EmailRequest): Promise<void> {
    const success = Math.random() > 0.7; // computing a sample success chance. 70%

    if (!success) {
      throw new Error("SendGrid failed to send email");
    }

    console.log(`[SendGrid] Email sent to ${email.to}`);
  }
}
