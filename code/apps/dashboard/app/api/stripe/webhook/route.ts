// Showcase note: the third leg, and the source of truth. Verifies the Stripe signature, then
// reconciles payment_intent and charge events (including delayed ACH success and failure) into
// orderPayment rows and order status, idempotently, because Stripe retries.

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { db, eq, and, sql } from '@workspace/database/client';
import {
  orderTable,
  orderPaymentTable,
  orderInvoiceTable,
  orderItemTable,
  productTable,
  companyTeamTable,
  organizationTable,
  userTable,
  eventYearTable,
  couponTable,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  ProductType
} from '@workspace/database/schema';
import { stripe } from '~/lib/stripe';
import { sendPurchaseConfirmationEmail } from '@workspace/email/send-purchase-confirmation-email';
import { sendAdminPurchaseNotificationEmail } from '@workspace/email/send-admin-purchase-notification-email';
import { confirmInventorySale, confirmTentSale } from '~/lib/inventory-management';

// Disable body parsing - we need the raw body for signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('❌ Webhook: Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('❌ Webhook: STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Webhook signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  console.log(`📨 Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`ℹ️ Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful payment - especially important for ACH payments that complete asynchronously
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('✅ Payment succeeded:', paymentIntent.id);

  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) {
    console.log('ℹ️ No orderId in metadata, skipping (may be a different payment type)');
    return;
  }

  // Get the order
  const [order] = await db
    .select()
    .from(orderTable)
    .where(eq(orderTable.id, orderId));

  if (!order) {
    console.error('❌ Webhook: Order not found:', orderId);
    return;
  }

  // Only process if order is in payment_processing status (ACH payment completing)
  // or pending status (direct payment that webhook arrived before frontend confirmation)
  if (order.status !== OrderStatus.PAYMENT_PROCESSING && order.status !== OrderStatus.PENDING) {
    console.log(`ℹ️ Order ${orderId} already in status ${order.status}, skipping webhook processing`);
    return;
  }

  console.log(`🔄 Processing webhook for order ${orderId} (current status: ${order.status})`);

  const paymentAmount = paymentIntent.amount / 100;
  const paymentMethodType = paymentIntent.payment_method_types[0] || 'unknown';

  // Determine if this is a sponsorship bank payment (no processing fee)
  const isSponsorshipBankPayment = paymentIntent.metadata?.paymentType === 'sponsorship' &&
    paymentIntent.metadata?.sponsorshipPaymentMethod === 'us_bank_account';

  let adjustedOrderTotal = order.totalAmount;
  if (isSponsorshipBankPayment) {
    const sponsorshipBaseAmount = parseFloat(paymentIntent.metadata.sponsorshipBaseAmount || '0');
    if (sponsorshipBaseAmount > 0) {
      adjustedOrderTotal = sponsorshipBaseAmount;
      console.log('💳 Sponsorship bank payment, adjusting total:', {
        original: order.totalAmount,
        adjusted: adjustedOrderTotal
      });
    }
  }

  // Determine new order status
  const isDepositPayment = paymentAmount < adjustedOrderTotal;
  const newOrderStatus = isDepositPayment ? OrderStatus.DEPOSIT_PAID : OrderStatus.FULLY_PAID;
  const paymentType = isDepositPayment ? PaymentType.DEPOSIT_PAYMENT : PaymentType.BALANCE_PAYMENT;

  // Check for existing payment to prevent duplicates (race condition with confirm-payment)
  const [existingPayment] = await db
    .select({ id: orderPaymentTable.id })
    .from(orderPaymentTable)
    .where(eq(orderPaymentTable.stripePaymentIntentId, paymentIntent.id))
    .limit(1);

  if (existingPayment) {
    console.log(`ℹ️ Payment record already exists for ${paymentIntent.id}, skipping webhook processing`);
    return;
  }

  // Create payment record
  console.log('💳 Creating payment record via webhook');
  await db.insert(orderPaymentTable).values({
    orderId,
    type: paymentType,
    status: PaymentStatus.COMPLETED,
    amount: paymentAmount,
    stripePaymentIntentId: paymentIntent.id,
    stripeChargeId: paymentIntent.latest_charge as string,
    paymentMethodType,
    processedAt: new Date(),
    metadata: {
      source: 'webhook',
      stripePaymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
      }
    }
  });

  // Update order status
  const orderUpdateFields: any = {
    status: newOrderStatus,
    stripePaymentIntentId: paymentIntent.id,
    updatedAt: new Date(),
  };

  // Update balanceOwed to 0 when order is fully paid
  if (newOrderStatus === OrderStatus.FULLY_PAID) {
    orderUpdateFields.balanceOwed = 0;
  }

  if (isSponsorshipBankPayment && adjustedOrderTotal !== order.totalAmount) {
    orderUpdateFields.totalAmount = adjustedOrderTotal;
    orderUpdateFields.balanceOwed = 0;
    const existingMetadata = order.metadata || {};
    orderUpdateFields.metadata = {
      ...existingMetadata,
      sponsorship: {
        ...(existingMetadata as any)?.sponsorship,
        paymentMethod: 'us_bank_account',
        processingFeeWaived: true,
        originalTotalWithFee: order.totalAmount,
        finalTotal: adjustedOrderTotal
      }
    };
  }

  await db
    .update(orderTable)
    .set(orderUpdateFields)
    .where(eq(orderTable.id, orderId));

  console.log(`✅ Order ${orderId} updated to status: ${newOrderStatus}`);

  // Create or update invoice
  const invoiceOrderTotal = isSponsorshipBankPayment ? adjustedOrderTotal : order.totalAmount;
  const balanceOwed = invoiceOrderTotal - paymentAmount;

  const [existingInvoice] = await db
    .select({ id: orderInvoiceTable.id, paidAmount: orderInvoiceTable.paidAmount })
    .from(orderInvoiceTable)
    .where(eq(orderInvoiceTable.orderId, orderId));

  if (existingInvoice) {
    // Derive paidAmount from actual completed payments to avoid over/under-counting
    // from confirm-payment / webhook race conditions
    const [paymentSum] = await db
      .select({ total: sql<number>`COALESCE(SUM(${orderPaymentTable.amount}), 0)` })
      .from(orderPaymentTable)
      .where(
        and(
          eq(orderPaymentTable.orderId, orderId),
          eq(orderPaymentTable.status, PaymentStatus.COMPLETED)
        )
      );

    const newPaidAmount = Number(paymentSum.total);
    const newBalanceOwed = invoiceOrderTotal - newPaidAmount;
    const invoiceStatus = newBalanceOwed <= 0 ? 'paid' : 'sent';

    await db
      .update(orderInvoiceTable)
      .set({
        paidAmount: newPaidAmount,
        balanceOwed: Math.max(0, newBalanceOwed),
        status: invoiceStatus,
        paidAt: newBalanceOwed <= 0 ? new Date() : undefined,
        updatedAt: new Date()
      })
      .where(eq(orderInvoiceTable.id, existingInvoice.id));
  } else {
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const invoiceStatus = balanceOwed <= 0 ? 'paid' : 'sent';
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    let invoiceNotes = `Payment of ${paymentAmount.toFixed(2)} received via ${paymentMethodType}`;
    if (isSponsorshipBankPayment) {
      invoiceNotes = `Sponsorship payment of ${paymentAmount.toFixed(2)} received via bank transfer (ACH). Processing fee waived.`;
    }

    await db.insert(orderInvoiceTable).values({
      orderId,
      invoiceNumber,
      totalAmount: invoiceOrderTotal,
      paidAmount: paymentAmount,
      balanceOwed: Math.max(0, balanceOwed),
      status: invoiceStatus,
      dueDate: balanceOwed > 0 ? dueDate : undefined,
      paidAt: balanceOwed <= 0 ? new Date() : undefined,
      sentAt: new Date(),
      stripeInvoiceId: paymentIntent.id,
      notes: invoiceNotes
    });
  }

  console.log('✅ Invoice created/updated via webhook');

  // Confirm inventory sales - only on the FIRST payment (deposit or full).
  // Skip for balance completion payments since inventory was already confirmed on deposit.
  const isBalanceCompletion = paymentIntent.metadata?.paymentType === 'balance_completion';
  if (isBalanceCompletion) {
    console.log('ℹ️ Skipping inventory confirmation — balance completion payment, inventory already confirmed on deposit');
  } else if (newOrderStatus === OrderStatus.FULLY_PAID || newOrderStatus === OrderStatus.DEPOSIT_PAID) {
    try {
      const orderItems = await db
        .select({
          productId: orderItemTable.productId,
          quantity: orderItemTable.quantity,
          productType: productTable.type
        })
        .from(orderItemTable)
        .innerJoin(productTable, eq(orderItemTable.productId, productTable.id))
        .where(eq(orderItemTable.orderId, orderId));

      for (const item of orderItems) {
        if (item.productType === ProductType.TENT_RENTAL) {
          await confirmTentSale(
            item.productId,
            order.organizationId,
            order.eventYearId,
            item.quantity
          );
        } else {
          await confirmInventorySale(item.productId, item.quantity);
        }
      }
      console.log('✅ Inventory confirmed via webhook');
    } catch (inventoryError) {
      console.error('❌ Inventory confirmation error:', inventoryError);
    }
  }

  // Create company teams when order is paid (deposit or full)
  if (newOrderStatus === OrderStatus.FULLY_PAID || newOrderStatus === OrderStatus.DEPOSIT_PAID) {
    try {
      await createCompanyTeamsForOrder(orderId, order.organizationId, order.eventYearId);
    } catch (teamError) {
      console.error('❌ Team creation error:', teamError);
    }
  }

  // Mark coupon as used
  if (order.metadata?.appliedCoupon?.id) {
    try {
      await db
        .update(couponTable)
        .set({
          currentUses: sql`${couponTable.currentUses} + 1`,
          updatedAt: new Date()
        })
        .where(eq(couponTable.id, order.metadata.appliedCoupon.id));
      console.log('✅ Coupon usage updated via webhook');
    } catch (couponError) {
      console.error('❌ Coupon update error:', couponError);
    }
  }

  // Send email notifications
  try {
    await sendWebhookEmailNotifications(orderId, paymentAmount, paymentIntent.metadata?.userId);
    console.log('✅ Email notifications sent via webhook');
  } catch (emailError) {
    console.error('❌ Email notification error:', emailError);
  }
}

/**
 * Handle failed payment - update order status back to pending
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('❌ Payment failed:', paymentIntent.id);

  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) {
    console.log('ℹ️ No orderId in metadata, skipping');
    return;
  }

  const [order] = await db
    .select()
    .from(orderTable)
    .where(eq(orderTable.id, orderId));

  if (!order) {
    console.error('❌ Webhook: Order not found:', orderId);
    return;
  }

  // Only update if order was in payment_processing status
  if (order.status !== OrderStatus.PAYMENT_PROCESSING) {
    console.log(`ℹ️ Order ${orderId} not in payment_processing status, skipping`);
    return;
  }

  // Update order back to pending
  await db
    .update(orderTable)
    .set({
      status: OrderStatus.PENDING,
      updatedAt: new Date(),
      metadata: {
        ...(order.metadata || {}),
        lastPaymentFailure: {
          paymentIntentId: paymentIntent.id,
          failedAt: new Date().toISOString(),
          error: paymentIntent.last_payment_error?.message || 'Unknown error'
        }
      }
    })
    .where(eq(orderTable.id, orderId));

  console.log(`✅ Order ${orderId} reverted to pending due to payment failure`);

  // TODO: Optionally send email notification about failed payment
}

/**
 * Creates company teams for team registration products in an order
 */
async function createCompanyTeamsForOrder(
  orderId: string,
  organizationId: string,
  eventYearId: string
): Promise<void> {
  const orderItems = await db
    .select({
      quantity: orderItemTable.quantity,
      productType: productTable.type,
      productName: productTable.name
    })
    .from(orderItemTable)
    .innerJoin(productTable, eq(orderItemTable.productId, productTable.id))
    .where(eq(orderItemTable.orderId, orderId));

  const teamRegistrationItems = orderItems.filter(
    item => item.productType === ProductType.TEAM_REGISTRATION
  );

  if (teamRegistrationItems.length === 0) {
    return;
  }

  const existingTeams = await db
    .select({
      teamNumber: companyTeamTable.teamNumber
    })
    .from(companyTeamTable)
    .where(
      eq(companyTeamTable.organizationId, organizationId)
    );

  const totalTeamsNeeded = teamRegistrationItems.reduce((sum, item) => sum + item.quantity, 0);

  if (existingTeams.length >= totalTeamsNeeded) {
    return;
  }

  const existingTeamNumbers = new Set(existingTeams.map(team => team.teamNumber));
  let nextTeamNumber = 1;
  const totalTeamsToCreate = totalTeamsNeeded - existingTeams.length;

  const teamsToCreate = [];
  for (let i = 0; i < totalTeamsToCreate; i++) {
    while (existingTeamNumbers.has(nextTeamNumber)) {
      nextTeamNumber++;
    }

    teamsToCreate.push({
      organizationId,
      eventYearId,
      teamNumber: nextTeamNumber,
      name: `Team ${nextTeamNumber}`,
      isPaid: true
    });

    existingTeamNumbers.add(nextTeamNumber);
    nextTeamNumber++;
  }

  if (teamsToCreate.length > 0) {
    await db.insert(companyTeamTable).values(teamsToCreate);
    console.log(`✅ Created ${teamsToCreate.length} company team(s) via webhook`);
  }
}

/**
 * Sends email notifications for webhook-completed payments
 */
async function sendWebhookEmailNotifications(
  orderId: string,
  paymentAmount: number,
  userId?: string
): Promise<void> {
  // Get order details
  const [orderData] = await db
    .select({
      orderNumber: orderTable.orderNumber,
      totalAmount: orderTable.totalAmount,
      organizationId: orderTable.organizationId,
      organizationName: organizationTable.name,
      eventYearName: eventYearTable.name,
      eventYearYear: eventYearTable.year,
      metadata: orderTable.metadata,
    })
    .from(orderTable)
    .innerJoin(organizationTable, eq(orderTable.organizationId, organizationTable.id))
    .innerJoin(eventYearTable, eq(orderTable.eventYearId, eventYearTable.id))
    .where(eq(orderTable.id, orderId));

  if (!orderData) {
    console.error('❌ Could not find order data for email notifications');
    return;
  }

  // Get user info
  let customerEmail = 'unknown@example.com';
  let customerName = 'Unknown User';

  if (userId) {
    const [user] = await db
      .select({ email: userTable.email, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId));

    if (user) {
      customerEmail = user.email || customerEmail;
      customerName = user.name || customerName;
    }
  }

  // Get order items
  const orderItems = await db
    .select({
      productName: productTable.name,
      quantity: orderItemTable.quantity,
      unitPrice: orderItemTable.unitPrice,
      totalPrice: orderItemTable.totalPrice,
    })
    .from(orderItemTable)
    .innerJoin(productTable, eq(orderItemTable.productId, productTable.id))
    .where(eq(orderItemTable.orderId, orderId));

  const remainingBalance = orderData.totalAmount - paymentAmount;
  const isFullPayment = remainingBalance <= 0;

  const appliedCoupon = orderData.metadata?.appliedCoupon || undefined;
  const couponDiscount = orderData.metadata?.couponDiscount || 0;
  const originalTotal = orderData.metadata?.originalTotal || orderData.totalAmount;

  const emailData = {
    customerName,
    customerEmail,
    organizationName: orderData.organizationName,
    orderNumber: orderData.orderNumber,
    totalAmount: orderData.totalAmount,
    originalTotal,
    paymentAmount,
    remainingBalance: Math.max(0, remainingBalance),
    orderItems: orderItems.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    })),
    eventYear: {
      name: orderData.eventYearName,
      year: orderData.eventYearYear
    },
    isFullPayment,
    appliedCoupon,
    couponDiscount,
    orderUrl: `${process.env.NEXT_PUBLIC_APP_URL}/organizations/${orderData.organizationId}/registration/orders?openOrder=${orderId}`
  };

  // Send customer confirmation
  await sendPurchaseConfirmationEmail({
    ...emailData,
    recipient: customerEmail
  });

  // Send admin notifications
  const superAdmins = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.isSportsFestAdmin, true));

  const validAdminEmails = superAdmins
    .map(admin => admin.email)
    .filter((email): email is string => email !== null);

  if (validAdminEmails.length > 0) {
    await sendAdminPurchaseNotificationEmail({
      ...emailData,
      adminDashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin`,
      recipients: validAdminEmails
    });
  }
}
