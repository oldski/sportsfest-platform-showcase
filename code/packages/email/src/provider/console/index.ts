import { keys } from '../../../keys';
import { type EmailPayload, type EmailProvider, type EmailHealthStatus } from '../types';

class ConsoleEmailProvider implements EmailProvider {
  private readonly from: string;

  constructor() {
    const from = keys().EMAIL_FROM;
    if (!from) {
      throw new Error('Missing EMAIL_FROM in environment configuration');
    }

    this.from = from;
  }

  public async sendEmail(payload: EmailPayload): Promise<{ id: string }> {
    console.log('\n📧 ============ EMAIL (DEV MODE - NOT SENT) ============');
    console.log('From:', this.from);
    console.log('To:', payload.recipient);
    console.log('Subject:', payload.subject);
    if (payload.replyTo) {
      console.log('Reply-To:', payload.replyTo);
    }
    console.log('------- HTML Preview -------');
    console.log(payload.html?.substring(0, 200) + '...');
    console.log('------- Plain Text -------');
    console.log(payload.text);
    console.log('📧 ====================================================\n');

    return { id: 'console-email-' + Date.now() };
  }

  public async checkHealth(): Promise<EmailHealthStatus> {
    return {
      status: 'healthy',
      message: 'Console provider active (development mode - emails logged, not sent)',
      details: {
        provider: 'console'
      }
    };
  }
}

export default new ConsoleEmailProvider();