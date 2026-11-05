// Showcase note: the first leg of a payment. Validates the cart against the database (never the
// client), applies deposit-now-balance-later math and any coupon, then creates a PaymentIntent whose
// metadata ties it back to the order. ACH and card share the same intent.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@workspace/auth';
import { db, eq, and, inArray } from '@workspace/database/client';
import { 
  organizationTable, 
  orderTable, 
  orderItemTable, 
  productTable,
  organizationPricingTable,
  eventYearTable,
  OrderStatus
} from '@workspace/database/schema';
import { stripe, STRIPE_CONFIG } from '~/lib/stripe';

export interface CreatePaymentIntentRequest {
  organizationSlug: string;
  cartItems: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentType: 'full' | 'deposit';
  appliedCoupon?: {
    id: string;
    code: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    calculatedDiscount: number;
  };
  skipPayment?: boolean;
}

export interface CreatePaymentIntentResponse {
  clientSecret?: string;
  orderId: string;
  amount: number;
  isFreeOrder?: boolean;
}

export async function POST(request: NextRequest) {
  console.log('🚀 Stripe payment intent API route called');
  
  try {
    const session = await auth();
    if (!session?.user) {
      console.log('❌ Unauthorized - no session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: CreatePaymentIntentRequest = await request.json();
    const { organizationSlug, cartItems, paymentType, appliedCoupon, skipPayment } = body;

    // Validate input
    if (!organizationSlug || !cartItems?.length || !paymentType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get organization
    const [organization] = await db
      .select()
      .from(organizationTable)
      .where(eq(organizationTable.slug, organizationSlug));

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Calculate order totals and create order
    const orderResult = await calculateAndCreateOrder(
      organization.id,
      cartItems,
      paymentType,
      appliedCoupon
    );

    if (!orderResult.success) {
      return NextResponse.json(
        { error: orderResult.error },
        { status: 400 }
      );
    }

    const { orderId, amount } = orderResult;

    // Handle free orders (100% off coupons)
    if (skipPayment || amount <= 0) {
      console.log('📋 Creating free order (no payment required), amount:', amount);

      // For free orders, just return the order ID and let the client handle completion
      // The payment modal won't show for free orders, and the success callback will be triggered immediately
      const response: CreatePaymentIntentResponse = {
        orderId,
        amount: 0,
        isFreeOrder: true,
      };

      return NextResponse.json(response);
    }

    // Create Stripe Payment Intent for paid orders
    console.log('💳 Creating payment intent with amount:', amount, 'cents:', Math.round(amount * 100));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: STRIPE_CONFIG.currency,
      payment_method_types: [...STRIPE_CONFIG.paymentMethodTypes],
      capture_method: STRIPE_CONFIG.captureMethod,
      confirmation_method: STRIPE_CONFIG.confirmationMethod,
      metadata: {
        orderId,
        organizationId: organization.id,
        organizationSlug,
        paymentType,
        userId: session.user.id!,
        couponCode: appliedCoupon?.code || '',
        couponDiscount: appliedCoupon?.calculatedDiscount?.toString() || '0',
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    // Update order with Stripe payment intent ID
    await db
      .update(orderTable)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date()
      })
      .where(eq(orderTable.id, orderId));

    const response: CreatePaymentIntentResponse = {
      clientSecret: paymentIntent.client_secret!,
      orderId,
      amount,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

async function calculateAndCreateOrder(
  organizationId: string,
  cartItems: Array<{ productId: string; quantity: number }>,
  paymentType: 'full' | 'deposit',
  appliedCoupon?: {
    id: string;
    code: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    calculatedDiscount: number;
  }
): Promise<{ success: true; orderId: string; amount: number } | { success: false; error: string }> {
  try {
    // Get the active event year
    const activeEventYear = await db
      .select({ id: eventYearTable.id })
      .from(eventYearTable)
      .where(and(
        eq(eventYearTable.isActive, true),
        eq(eventYearTable.isDeleted, false)
      ))
      .limit(1);

    if (!activeEventYear.length) {
      return { success: false, error: 'No active event year found' };
    }

    // Get product details with organization-specific pricing
    const productIds = cartItems.map(item => item.productId);
    
    const products = await db
      .select({
        id: productTable.id,
        name: productTable.name,
        basePrice: productTable.basePrice,
        depositAmount: productTable.depositAmount,
        requiresDeposit: productTable.requiresDeposit,
        customPrice: organizationPricingTable.customPrice,
        customDepositAmount: organizationPricingTable.customDepositAmount,
        isWaived: organizationPricingTable.isWaived,
        maxQuantity: organizationPricingTable.maxQuantity,
      })
      .from(productTable)
      .leftJoin(
        organizationPricingTable,
        and(
          eq(organizationPricingTable.productId, productTable.id),
          eq(organizationPricingTable.organizationId, organizationId)
        )
      )
      .where(inArray(productTable.id, productIds));

    // Calculate totals
    let totalAmount = 0;
    let depositPaymentAmount = 0; // Amount due today if paying deposit (deposits + full price for non-deposit items)
    let actualDepositAmount = 0;  // Sum of deposit amounts for items with deposits (for order record)
    const orderItems: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      depositPrice: number;
      totalPrice: number;
    }> = [];

    for (const cartItem of cartItems) {
      const product = products.find(p => p.id === cartItem.productId);
      if (!product) {
        return { success: false, error: `Product ${cartItem.productId} not found` };
      }

      // Determine pricing (custom pricing overrides base pricing)
      const unitPrice = product.customPrice ?? product.basePrice;
      const unitDepositPrice = product.customDepositAmount ?? product.depositAmount ?? 0;
      const hasDeposit = product.requiresDeposit && unitDepositPrice > 0;

      // Check if waived
      if (product.isWaived) {
        orderItems.push({
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          unitPrice: 0,
          depositPrice: 0,
          totalPrice: 0,
        });
        continue;
      }

      // Check quantity limits
      if (product.maxQuantity && cartItem.quantity > product.maxQuantity) {
        return {
          success: false,
          error: `Quantity ${cartItem.quantity} exceeds limit of ${product.maxQuantity} for ${product.name}`
        };
      }

      const itemTotal = unitPrice * cartItem.quantity;
      // For deposit payment: items with deposits pay deposit, items without pay full price
      const itemDepositPayment = hasDeposit
        ? (unitDepositPrice * cartItem.quantity)  // Pay deposit for items with deposits
        : itemTotal;                               // Pay full price for items without deposits

      orderItems.push({
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        unitPrice,
        depositPrice: unitDepositPrice,
        totalPrice: itemTotal,
      });

      totalAmount += itemTotal;
      depositPaymentAmount += itemDepositPayment;
      if (hasDeposit) {
        actualDepositAmount += unitDepositPrice * cartItem.quantity;
      }
    }

    // Calculate coupon discount
    const couponDiscount = appliedCoupon?.calculatedDiscount || 0;

    // Apply coupon discount to the amounts
    const discountedTotalAmount = Math.max(0, totalAmount - couponDiscount);
    const discountedDepositPayment = Math.max(0, depositPaymentAmount - couponDiscount);

    // Determine payment amount based on type (with coupon applied)
    // For deposit: charge deposit for items with deposits + full price for items without
    // For full: charge the full discounted total
    const paymentAmount = paymentType === 'deposit' ? discountedDepositPayment : discountedTotalAmount;
    const balanceOwed = discountedTotalAmount - paymentAmount;

    // Allow $0 payments for 100% off coupons
    if (paymentAmount < 0) {
      return { success: false, error: 'Payment amount cannot be negative' };
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Calculate discounted deposit amount for order record
    const discountedActualDeposit = Math.max(0, actualDepositAmount - couponDiscount);

    // Create order
    const [order] = await db
      .insert(orderTable)
      .values({
        orderNumber,
        organizationId,
        eventYearId: activeEventYear[0].id,
        status: OrderStatus.PENDING,
        totalAmount: discountedTotalAmount, // Store discounted amount as the actual order total
        depositAmount: discountedActualDeposit, // Deposit portion only (for items with deposits)
        balanceOwed,
        metadata: {
          cartItems,
          paymentType,
          originalTotal: totalAmount,
          couponDiscount: couponDiscount,
          appliedCoupon: appliedCoupon || null,
        },
      })
      .returning({ id: orderTable.id });

    // Create order items
    await db.insert(orderItemTable).values(
      orderItems.map(item => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        depositPrice: item.depositPrice,
        totalPrice: item.totalPrice,
      }))
    );

    return {
      success: true,
      orderId: order.id,
      amount: paymentAmount,
    };

  } catch (error) {
    console.error('Error calculating and creating order:', error);
    // Return more specific error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Failed to create order';
    return { success: false, error: `Failed to create order: ${errorMessage}` };
  }
}