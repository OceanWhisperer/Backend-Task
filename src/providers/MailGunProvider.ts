import { EmailRequest } from "../models/EmailRequest";

export class MailgunProvider {
  async sendEmail(email: EmailRequest): Promise<void> {
    const success = Math.random() > 0.7; // Sample 50% success chance.

    if (!success) {
      throw new Error("Mailgun failed to send email");
    }

    console.log(`[Mailgun] Email sent to ${email.to}`);
  }
}
