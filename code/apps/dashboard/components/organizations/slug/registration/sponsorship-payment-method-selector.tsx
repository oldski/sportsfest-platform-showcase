// Showcase note: card versus bank transfer in the UI. Sponsorship invoices are often five figures,
// so ACH is offered beside card with copy that sets expectations about settlement time.

'use client';

import * as React from 'react';
import {
  CreditCardIcon,
  BuildingIcon,
  CheckIcon,
  ClockIcon,
  ZapIcon,
  HeartHandshakeIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@workspace/ui/components/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter
} from '@workspace/ui/components/drawer';
import { useMediaQuery } from '@workspace/ui/hooks/use-media-query';
import { cn } from '@workspace/ui/lib/utils';

export type SponsorshipPaymentMethodType = 'card' | 'us_bank_account';

interface SponsorshipPaymentMethodSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (paymentMethod: SponsorshipPaymentMethodType) => void;
  baseAmount: number;
  processingFee: number;
  isLoading?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

interface PaymentOptionCardProps {
  type: SponsorshipPaymentMethodType;
  title: string;
  subtitle: string;
  amount: number;
  originalAmount?: number;
  savings?: number;
  features: string[];
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  recommended?: boolean;
}

function PaymentOptionCard({
  type,
  title,
  subtitle,
  amount,
  originalAmount,
  savings,
  features,
  icon,
  isSelected,
  onSelect,
  recommended
}: PaymentOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full p-4 rounded-lg border-2 text-left transition-all',
        'hover:border-primary/50 hover:bg-accent/50',
        isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border bg-background'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Radio indicator */}
        <div
          className={cn(
            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/30'
          )}
        >
          {isSelected && <CheckIcon className="h-3 w-3" />}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">{title}</span>
                {recommended && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="text-right">
              {icon}
            </div>
          </div>

          {/* Amount display */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatCurrency(amount)}</span>
              {savings && savings > 0 && (
                <span className="text-sm text-green-600 font-medium">
                  Save {formatCurrency(savings)}
                </span>
              )}
            </div>
            {originalAmount && originalAmount !== amount && (
              <p className="text-sm text-muted-foreground">
                <span className="line-through">{formatCurrency(originalAmount)}</span>
                <span className="ml-2">No processing fee</span>
              </p>
            )}
          </div>

          {/* Features */}
          <ul className="space-y-1">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckIcon className="h-3.5 w-3.5 text-green-600 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}

export function SponsorshipPaymentMethodSelector({
  isOpen,
  onClose,
  onSelect,
  baseAmount,
  processingFee,
  isLoading = false
}: SponsorshipPaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = React.useState<SponsorshipPaymentMethodType | null>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const cardTotal = baseAmount + processingFee;
  const bankTotal = baseAmount;
  const savings = processingFee;

  const handleContinue = () => {
    if (selectedMethod) {
      onSelect(selectedMethod);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedMethod(null);
      onClose();
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Sponsorship Summary */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <HeartHandshakeIcon className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-purple-900">Sponsorship Payment</span>
        </div>
        <p className="text-sm text-purple-700">
          Base sponsorship amount: <span className="font-semibold">{formatCurrency(baseAmount)}</span>
        </p>
      </div>

      {/* Payment Options */}
      <div className="space-y-3">
        <PaymentOptionCard
          type="us_bank_account"
          title="Bank Transfer (ACH)"
          subtitle="Pay directly from your bank account"
          amount={bankTotal}
          originalAmount={cardTotal}
          savings={savings}
          features={[
            'No processing fees',
            '3-5 business days to process',
            'Secure bank-level encryption'
          ]}
          icon={<BuildingIcon className="h-6 w-6 text-muted-foreground" />}
          isSelected={selectedMethod === 'us_bank_account'}
          onSelect={() => setSelectedMethod('us_bank_account')}
          recommended
        />

        <PaymentOptionCard
          type="card"
          title="Credit/Debit Card"
          subtitle="Visa, Mastercard, American Express"
          amount={cardTotal}
          features={[
            'Instant processing',
            `Includes ${formatCurrency(processingFee)} processing fee`,
            'All major cards accepted'
          ]}
          icon={<CreditCardIcon className="h-6 w-6 text-muted-foreground" />}
          isSelected={selectedMethod === 'card'}
          onSelect={() => setSelectedMethod('card')}
        />
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
        <ClockIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Bank transfers typically take 3-5 business days to process.
          Your sponsorship will be confirmed once the payment clears.
          Card payments are processed instantly.
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleClose}
        disabled={isLoading}
      >
        Cancel
      </Button>
      <Button
        type="button"
        onClick={handleContinue}
        disabled={!selectedMethod || isLoading}
      >
        {isLoading ? (
          'Processing...'
        ) : selectedMethod === 'us_bank_account' ? (
          <>
            <BuildingIcon className="mr-2 h-4 w-4" />
            Continue with Bank Transfer
          </>
        ) : selectedMethod === 'card' ? (
          <>
            <CreditCardIcon className="mr-2 h-4 w-4" />
            Continue with Card
          </>
        ) : (
          'Select a Payment Method'
        )}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>
              Select how you&apos;d like to pay for your sponsorship
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>
            {footer}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Choose Payment Method</DrawerTitle>
          <DrawerDescription>
            Select how you&apos;d like to pay for your sponsorship
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4">
          {content}
        </div>
        <DrawerFooter>
          {footer}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
