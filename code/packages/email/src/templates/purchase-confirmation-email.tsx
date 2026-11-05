// Showcase note: one of sixteen React Email templates. Props are plain data (order, items, totals,
// coupon); the sender renders it to HTML and hands it to the provider.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';
import * as React from 'react';

import { APP_NAME } from '@workspace/common/app';

export interface PurchaseConfirmationEmailProps {
  customerName: string;
  organizationName: string;
  orderNumber: string;
  totalAmount: number;
  originalTotal?: number;
  paymentAmount: number;
  remainingBalance: number;
  orderItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  eventYear: {
    name: string;
    year: number;
  };
  isFullPayment: boolean;
  orderUrl: string;
  appliedCoupon?: {
    id: string;
    code: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    calculatedDiscount: number;
  };
  couponDiscount?: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export const PurchaseConfirmationEmail = ({
  customerName = 'John Doe',
  organizationName = 'Acme Corp',
  orderNumber = 'ORD-12345',
  totalAmount = 150.00,
  originalTotal,
  paymentAmount = 150.00,
  remainingBalance = 0,
  orderItems = [
    { name: 'Team Registration', quantity: 1, unitPrice: 100.00, totalPrice: 100.00 },
    { name: 'Tent Rental', quantity: 1, unitPrice: 50.00, totalPrice: 50.00 }
  ],
  eventYear = { name: 'Summer Sports Festival', year: 2025 },
  isFullPayment = true,
  orderUrl = 'https://sportsfest.com/orders/12345',
  appliedCoupon,
  couponDiscount = 0
}: PurchaseConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>
      {isFullPayment
        ? `Payment confirmed for ${orderNumber} - ${formatCurrency(paymentAmount)}`
        : `Payment received for ${orderNumber} - ${formatCurrency(paymentAmount)}`
      }
    </Preview>
    <Tailwind>
      <Body className="bg-white my-auto mx-auto font-sans px-2">
        <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
          <Section className="mt-[32px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              🎉 Payment {isFullPayment ? 'Confirmed' : 'Received'}!
            </Heading>
          </Section>

          <Text className="text-black text-[14px] leading-[24px]">
            Hi {customerName},
          </Text>

          <Text className="text-black text-[14px] leading-[24px]">
            {appliedCoupon && couponDiscount > 0 && totalAmount === 0
              ? `Fantastic! Your coupon "${appliedCoupon.code}" provided a 100% discount for ${eventYear.name} ${eventYear.year}. Your registration is complete at no cost!`
              : isFullPayment
              ? `Great news! We've successfully processed your payment for ${eventYear.name} ${eventYear.year}.`
              : `Thank you! We've received your payment for ${eventYear.name} ${eventYear.year}.`
            }
          </Text>

          {/* Order Summary */}
          <Section className="bg-[#f6f9fc] rounded-[4px] p-[20px] my-[32px]">
            <Heading className="text-black text-[18px] font-semibold mt-0 mb-[16px]">
              Order Summary
            </Heading>
            <Text className="text-[14px] text-gray-600 mt-0 mb-[8px]">
              <strong>Order Number:</strong> {orderNumber}
            </Text>
            <Text className="text-[14px] text-gray-600 mt-0 mb-[8px]">
              <strong>Organization:</strong> {organizationName}
            </Text>
            <Text className="text-[14px] text-gray-600 mt-0 mb-[16px]">
              <strong>Event:</strong> {eventYear.name} {eventYear.year}
            </Text>

            {/* Order Items */}
            <div className="border-t border-gray-200 pt-[16px]">
              {orderItems.map((item, index) => (
                <div key={index} className="flex justify-between mb-[8px]">
                  <div className="text-[14px] text-black">
                    {item.name} x {item.quantity}
                  </div>
                  <div className="text-[14px] text-black font-medium">
                    {formatCurrency(item.totalPrice)}
                  </div>
                </div>
              ))}
            </div>

            <Hr className="my-[16px]" />

            {/* Payment Summary */}
            {appliedCoupon && couponDiscount > 0 ? (
              <>
                <div className="flex justify-between mb-[8px]">
                  <div className="text-[14px] text-black">Subtotal:</div>
                  <div className="text-[14px] text-black">{formatCurrency(originalTotal || (totalAmount + couponDiscount))}</div>
                </div>
                <div className="flex justify-between mb-[8px]">
                  <div className="text-[14px] text-green-600">
                    Coupon Discount ({appliedCoupon.code}):
                  </div>
                  <div className="text-[14px] text-green-600 font-medium">
                    -{formatCurrency(couponDiscount)}
                  </div>
                </div>
                <div className="flex justify-between mb-[8px]">
                  <div className="text-[14px] font-semibold text-black">Total Order:</div>
                  <div className="text-[14px] font-semibold text-black">{formatCurrency(totalAmount)}</div>
                </div>
              </>
            ) : (
              <div className="flex justify-between mb-[8px]">
                <div className="text-[14px] font-semibold text-black">Total Order:</div>
                <div className="text-[14px] font-semibold text-black">{formatCurrency(totalAmount)}</div>
              </div>
            )}
            <div className="flex justify-between mb-[8px]">
              <div className="text-[14px] text-green-600">Payment Received:</div>
              <div className="text-[14px] text-green-600 font-medium">{formatCurrency(paymentAmount)}</div>
            </div>
            {remainingBalance > 0 && (
              <div className="flex justify-between">
                <div className="text-[14px] text-orange-600">Remaining Balance:</div>
                <div className="text-[14px] text-orange-600 font-medium">{formatCurrency(remainingBalance)}</div>
              </div>
            )}
          </Section>

          {remainingBalance > 0 ? (
            <Text className="text-black text-[14px] leading-[24px]">
              You have a remaining balance of <strong>{formatCurrency(remainingBalance)}</strong>.
              You can complete your payment anytime before the event.
            </Text>
          ) : (
            <Text className="text-black text-[14px] leading-[24px]">
              Your order is now fully paid and confirmed! We're excited to see you at the event.
            </Text>
          )}

          <Section className="text-center mt-[32px] mb-[32px]">
            <Button
              className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              href={orderUrl}
            >
              View Order Details
            </Button>
          </Section>

          <Text className="text-black text-[14px] leading-[24px]">
            If you have any questions about your order, please don't hesitate to reach out to us.
          </Text>

          <Text className="text-black text-[14px] leading-[24px]">
            Best regards,
            <br />
            The {APP_NAME} Team
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default PurchaseConfirmationEmail;