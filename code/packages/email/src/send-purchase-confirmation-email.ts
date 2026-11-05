// Showcase note: a sender: render the template, pick the provider, send. Every email in the
// product follows this three-line shape.

import { render } from '@react-email/render';

import { APP_NAME } from '@workspace/common/app';

import { EmailProvider } from './provider';
import {
  PurchaseConfirmationEmail,
  type PurchaseConfirmationEmailProps
} from './templates/purchase-confirmation-email';

export async function sendPurchaseConfirmationEmail(
  input: PurchaseConfirmationEmailProps & { recipient: string }
): Promise<void> {
  const component = PurchaseConfirmationEmail(input);
  const html = await render(component);
  const text = await render(component, { plainText: true });

  const subject = input.isFullPayment
    ? `Payment Confirmed - ${input.orderNumber} (${input.eventYear.name})`
    : `Payment Received - ${input.orderNumber} (${input.eventYear.name})`;

  await EmailProvider.sendEmail({
    recipient: input.recipient,
    subject,
    html,
    text
  });
}