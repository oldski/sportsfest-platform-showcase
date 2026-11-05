// Showcase note: one Stripe client for the dashboard, configured for card and US bank account
// (ACH) payment methods. Everything that touches money imports this instead of constructing its own.

import { BillingProvider } from '@workspace/billing/provider';

// Use the existing Stripe instance from billing workspace
export const stripe = BillingProvider.getStripe();

// Client-side publishable key - not a server action, just a constant
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_BILLING_STRIPE_PUBLISHABLE_KEY!;

// Stripe configuration constants
export const STRIPE_CONFIG = {
  currency: 'usd',
  paymentMethodTypes: ['card', 'us_bank_account'],
  captureMethod: 'automatic' as const,
  confirmationMethod: 'automatic' as const,
} as const;

// Sponsorship-specific configuration
export const SPONSORSHIP_CONFIG = {
  // Processing fee calculation (Stripe fee passthrough: 2.9% + $0.30)
  calculateProcessingFee: (baseAmount: number): number => {
    return Math.round((baseAmount * 0.029 + 0.30) * 100) / 100;
  },
  // Calculate total with processing fee
  calculateTotalWithFee: (baseAmount: number): number => {
    const fee = Math.round((baseAmount * 0.029 + 0.30) * 100) / 100;
    return Math.round((baseAmount + fee) * 100) / 100;
  },
} as const;