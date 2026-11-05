// Showcase note: email goes through a provider interface. Resend is the production provider;
// Nodemailer, SendGrid, Postmark and a console logger implement the same contract, chosen by
// environment. Senders never know which one is live.

import type { EmailProvider as IEmailProvider, EmailHealthStatus } from './types';

/**
 * Email Provider Selection
 *
 * Automatically selects the appropriate email provider based on environment:
 * - Development (NODE_ENV !== 'production'): Console provider (logs emails, doesn't send)
 * - Production (NODE_ENV === 'production'): Resend provider (sends real emails)
 *
 * Override with EMAIL_PROVIDER env variable:
 * - 'console' - Always use console (useful for testing in production)
 * - 'resend' - Always use resend (useful for testing real emails in dev)
 */

const getEmailProvider = (): IEmailProvider => {
  const envProvider = process.env.EMAIL_PROVIDER;
  const isProduction = process.env.NODE_ENV === 'production';

  // Allow explicit override via EMAIL_PROVIDER env variable
  if (envProvider === 'console') {
    const ConsoleProvider = require('./console').default;
    return ConsoleProvider;
  }

  if (envProvider === 'resend') {
    const ResendProvider = require('./resend').default;
    return ResendProvider;
  }

  // Default behavior: console in dev, resend in production
  if (isProduction) {
    const ResendProvider = require('./resend').default;
    return ResendProvider;
  }

  const ConsoleProvider = require('./console').default;
  return ConsoleProvider;
};

export const EmailProvider = getEmailProvider();

/**
 * Check email service health
 * Returns status, message, and details about the configured email provider
 */
export async function checkEmailHealth(): Promise<EmailHealthStatus> {
  try {
    const provider = getEmailProvider();
    if (provider.checkHealth) {
      return await provider.checkHealth();
    }
    return {
      status: 'healthy',
      message: 'Email provider configured (health check not available)',
      details: {
        provider: 'unknown'
      }
    };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Email provider not configured',
      details: {
        provider: 'none'
      }
    };
  }
}

export type { EmailHealthStatus } from './types';
