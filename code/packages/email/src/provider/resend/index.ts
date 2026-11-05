// Showcase note: the Resend implementation of the provider contract.

import { Resend, type CreateEmailResponse } from 'resend';

import { keys } from '../../../keys';
import { type EmailPayload, type EmailProvider, type EmailHealthStatus } from '../types';

class ResendEmailProvider implements EmailProvider {
  private readonly from: string;
  private readonly client: Resend;

  constructor() {
    const from = keys().EMAIL_FROM;
    if (!from) {
      throw new Error('Missing EMAIL_FROM in environment configuration');
    }

    const apiKey = keys().EMAIL_RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing EMAIL_RESEND_API_KEY in environment configuration'
      );
    }

    this.from = from;
    this.client = new Resend(apiKey);
  }

  public async sendEmail(payload: EmailPayload): Promise<CreateEmailResponse> {
    const response = await this.client.emails.send({
      from: this.from,
      to: payload.recipient,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo
    });
    if (response.error) {
      throw Error(response.error.message ?? 'Could not send mail.');
    }

    return response;
  }

  public async checkHealth(): Promise<EmailHealthStatus> {
    try {
      const domains = await this.client.domains.list();

      if (domains.error) {
        return {
          status: 'degraded',
          message: domains.error.message || 'Failed to fetch domain status',
          details: {
            provider: 'resend'
          }
        };
      }

      const domainList = domains.data?.data || [];
      const verifiedDomains = domainList.filter(d => d.status === 'verified');

      if (domainList.length === 0) {
        return {
          status: 'degraded',
          message: 'No sending domains configured in Resend',
          details: {
            provider: 'resend',
            domainsConfigured: 0,
            domainsVerified: 0
          }
        };
      }

      if (verifiedDomains.length === 0) {
        return {
          status: 'degraded',
          message: `${domainList.length} domain(s) configured but none are verified`,
          details: {
            provider: 'resend',
            domainsConfigured: domainList.length,
            domainsVerified: 0
          }
        };
      }

      return {
        status: 'healthy',
        message: `${verifiedDomains.length} of ${domainList.length} domain(s) verified`,
        details: {
          provider: 'resend',
          domainsConfigured: domainList.length,
          domainsVerified: verifiedDomains.length
        }
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Failed to connect to Resend API',
        details: {
          provider: 'resend'
        }
      };
    }
  }
}

export default new ResendEmailProvider();
