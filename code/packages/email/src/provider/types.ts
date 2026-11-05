export type EmailPayload = {
  recipient: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type EmailHealthStatus = {
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  details?: {
    provider: string;
    domainsConfigured?: number;
    domainsVerified?: number;
  };
};

export type EmailProvider = {
  sendEmail(payload: EmailPayload): Promise<unknown>;
  checkHealth?(): Promise<EmailHealthStatus>;
};
