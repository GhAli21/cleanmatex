# PRD-012: Payments - Implementation Plan
# Educational Guide for Solo Developer

**Document Version**: 1.0  
**Last Updated**: November 1, 2025  
**Estimated Duration**: Week 13 (5 days)  
**Difficulty**: ⭐⭐⭐⭐⭐ Complex  
**Prerequisites**: PRD 001-011 completed

---

## 📚 **WHAT YOU'LL LEARN**

### Technical Skills
- ✅ Payment gateway integration (HyperPay, PayTabs, Stripe)
- ✅ Webhook handling and signature verification
- ✅ Idempotency keys
- ✅ Payment state machines
- ✅ Refund processing
- ✅ PCI compliance basics
- ✅ Multi-currency handling
- ✅ Payment retry logic

---

## 🎯 **BUSINESS GOAL**

Integrate multiple payment gateways to accept:
- Credit/Debit cards
- Apple Pay / Google Pay
- Local payment methods (KNET, NAPS, Mada)
- Cash on delivery
- Payment links (WhatsApp/Email)

---

## 🗄️ **DAY 1: DATABASE SCHEMA (3-4 hours)**

**File**: `apps/api/prisma/schema.prisma`

```prisma
model Payment {
  id              String   @id @default(uuid())
  tenantId        String
  orderId         String
  
  // Payment identification
  paymentNumber   String   @unique
  
  // Gateway details
  gateway         PaymentGateway
  gatewayTxnId    String?  // Gateway's transaction ID
  
  // Amounts
  amount          Decimal  @db.Decimal(10, 2)
  currency        String   @default("OMR")
  
  // Method
  method          PaymentMethod
  
  // Status
  status          PaymentStatus @default(PENDING)
  
  // Payment flow
  paymentUrl      String?  @db.Text // For redirect/QR
  expiresAt       DateTime?
  
  // Completion
  paidAt          DateTime?
  failedAt        DateTime?
  failureReason   String?  @db.Text
  
  // Refunds
  refundedAmount  Decimal?  @db.Decimal(10, 2)
  refundedAt      DateTime?
  
  // Metadata
  metadata        Json?     @db.JsonB
  
  // Idempotency
  idempotencyKey  String?   @unique
  
  // Relations
  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  order           Order     @relation(fields: [orderId], references: [id])
  refunds         Refund[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([orderId, status])
  @@index([gatewayTxnId])
  @@map("org_payments_tr")
}

model Refund {
  id              String   @id @default(uuid())
  paymentId       String
  tenantId        String
  
  refundNumber    String   @unique
  amount          Decimal  @db.Decimal(10, 2)
  reason          String   @db.Text
  status          RefundStatus @default(PENDING)
  
  gatewayRefundId String?
  processedAt     DateTime?
  
  // Relations
  payment         Payment  @relation(fields: [paymentId], references: [id])
  
  createdAt DateTime @default(now())
  
  @@map("org_refunds_tr")
}

enum PaymentGateway {
  HYPERPAY
  PAYTABS
  STRIPE
  MANUAL   // Cash, Bank transfer
}

enum PaymentMethod {
  CREDIT_CARD
  DEBIT_CARD
  APPLE_PAY
  GOOGLE_PAY
  KNET
  MADA
  CASH
  BANK_TRANSFER
}

enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum RefundStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

---

## 🚀 **DAY 2: PAYMENT GATEWAY ABSTRACTION (6-7 hours)**

### Concept: Plugin Architecture

```
PaymentGateway Interface (Abstract)
├── HyperPayGateway (Implementation)
├── PayTabsGateway (Implementation)
└── StripeGateway (Implementation)

Benefits:
- Easy to add new gateways
- Consistent API
- Easy testing (mock gateways)
```

**File**: `apps/api/src/payments/interfaces/payment-gateway.interface.ts`

```typescript
export interface PaymentGatewayInterface {
  // Create payment session
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>;
  
  // Verify webhook signature
  verifyWebhook(payload: any, signature: string): boolean;
  
  // Process webhook
  processWebhook(payload: any): Promise<WebhookResult>;
  
  // Refund
  refund(params: RefundParams): Promise<RefundResponse>;
  
  // Get payment status
  getPaymentStatus(gatewayTxnId: string): Promise<PaymentStatusResponse>;
}

export interface CreatePaymentParams {
  amount: number;
  currency: string;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl: string;
  callbackUrl: string;
  idempotencyKey: string;
}

export interface CreatePaymentResponse {
  paymentId: string;
  paymentUrl: string;
  expiresAt: Date;
}

// ... other interfaces
```

---

### Stripe Gateway Example

**File**: `apps/api/src/payments/gateways/stripe.gateway.ts`

```typescript
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentGatewayInterface } from '../interfaces';

@Injectable()
export class StripeGateway implements PaymentGatewayInterface {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse> {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: `Order #${params.orderId}`,
            },
            unit_amount: Math.round(params.amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.returnUrl,
      cancel_url: params.returnUrl,
      metadata: {
        orderId: params.orderId,
        idempotencyKey: params.idempotencyKey,
      },
    });

    return {
      paymentId: session.id,
      paymentUrl: session.url!,
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  verifyWebhook(payload: any, signature: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  async processWebhook(payload: any): Promise<WebhookResult> {
    const event = payload;

    switch (event.type) {
      case 'checkout.session.completed':
        return {
          status: 'COMPLETED',
          gatewayTxnId: event.data.object.id,
          amount: event.data.object.amount_total / 100,
          currency: event.data.object.currency.toUpperCase(),
          orderId: event.data.object.metadata.orderId,
        };

      case 'checkout.session.expired':
        return {
          status: 'FAILED',
          gatewayTxnId: event.data.object.id,
          failureReason: 'Payment session expired',
          orderId: event.data.object.metadata.orderId,
        };

      default:
        return { status: 'IGNORED' };
    }
  }

  async refund(params: RefundParams): Promise<RefundResponse> {
    const refund = await this.stripe.refunds.create({
      payment_intent: params.gatewayTxnId,
      amount: Math.round(params.amount * 100),
      reason: 'requested_by_customer',
    });

    return {
      refundId: refund.id,
      status: refund.status === 'succeeded' ? 'COMPLETED' : 'PENDING',
    };
  }

  async getPaymentStatus(gatewayTxnId: string): Promise<PaymentStatusResponse> {
    const session = await this.stripe.checkout.sessions.retrieve(gatewayTxnId);
    
    return {
      status: session.payment_status === 'paid' ? 'COMPLETED' : 'PENDING',
      amount: session.amount_total ? session.amount_total / 100 : 0,
    };
  }
}
```

---

## 🎫 **DAY 3: PAYMENT SERVICE (5-6 hours)**

**File**: `apps/api/src/payments/payments.service.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeGateway } from './gateways/stripe.gateway';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private stripeGateway: StripeGateway,
    // ... other gateways
  ) {}

  /**
   * Create payment intent
   */
  async createPayment(data: {
    orderId: string;
    amount: number;
    gateway: string;
    method: string;
    customerEmail?: string;
    idempotencyKey?: string;
  }) {
    // Get order
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { tenant: true },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Generate idempotency key if not provided
    const idempotencyKey = data.idempotencyKey || uuidv4();

    // Check for duplicate payment (idempotency)
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return existing; // Return existing payment
    }

    // Generate payment number
    const paymentNumber = `PAY-${Date.now()}`;

    // Select gateway
    const gateway = this.getGateway(data.gateway);

    // Create payment in gateway
    const gatewayResponse = await gateway.createPayment({
      amount: data.amount,
      currency: order.currency,
      orderId: order.id,
      customerEmail: data.customerEmail,
      returnUrl: `${process.env.APP_URL}/payments/return/${order.id}`,
      callbackUrl: `${process.env.API_URL}/webhooks/payments/${data.gateway}`,
      idempotencyKey,
    });

    // Save payment record
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        paymentNumber,
        gateway: data.gateway as any,
        gatewayTxnId: gatewayResponse.paymentId,
        amount: data.amount,
        currency: order.currency,
        method: data.method as any,
        status: 'PENDING',
        paymentUrl: gatewayResponse.paymentUrl,
        expiresAt: gatewayResponse.expiresAt,
        idempotencyKey,
      },
    });

    this.eventEmitter.emit('payment.created', payment);

    return payment;
  }

  /**
   * Process payment webhook
   */
  async processWebhook(gateway: string, payload: any, signature: string) {
    // Get gateway implementation
    const gatewayImpl = this.getGateway(gateway);

    // Verify signature
    if (!gatewayImpl.verifyWebhook(payload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process webhook
    const result = await gatewayImpl.processWebhook(payload);

    if (result.status === 'IGNORED') {
      return { message: 'Webhook ignored' };
    }

    // Find payment
    const payment = await this.prisma.payment.findFirst({
      where: {
        gatewayTxnId: result.gatewayTxnId,
      },
      include: { order: true },
    });

    if (!payment) {
      return { message: 'Payment not found' };
    }

    // Update payment status
    if (result.status === 'COMPLETED') {
      await this.completePayment(payment.id);
    } else if (result.status === 'FAILED') {
      await this.failPayment(payment.id, result.failureReason);
    }

    return { message: 'Webhook processed' };
  }

  /**
   * Complete payment
   */
  private async completePayment(paymentId: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
      },
      include: { order: true },
    });

    // Update order payment status
    const totalPaid = await this.prisma.payment.aggregate({
      where: {
        orderId: payment.orderId,
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });

    const orderTotal = Number(payment.order.total);
    const paid = Number(totalPaid._sum.amount || 0);

    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: paid >= orderTotal ? 'PAID' : 'PARTIALLY_PAID',
      },
    });

    this.eventEmitter.emit('payment.completed', payment);

    return payment;
  }

  /**
   * Process refund
   */
  async refundPayment(paymentId: string, amount: number, reason: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException('Can only refund completed payments');
    }

    // Process refund in gateway
    const gateway = this.getGateway(payment.gateway);
    const refundResponse = await gateway.refund({
      gatewayTxnId: payment.gatewayTxnId!,
      amount,
    });

    // Create refund record
    const refund = await this.prisma.refund.create({
      data: {
        paymentId,
        tenantId: payment.tenantId,
        refundNumber: `REF-${Date.now()}`,
        amount,
        reason,
        status: refundResponse.status as any,
        gatewayRefundId: refundResponse.refundId,
        processedAt: refundResponse.status === 'COMPLETED' ? new Date() : null,
      },
    });

    // Update payment
    const totalRefunded = await this.prisma.refund.aggregate({
      where: { paymentId },
      _sum: { amount: true },
    });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundedAmount: totalRefunded._sum.amount,
        status:
          Number(totalRefunded._sum.amount) >= Number(payment.amount)
            ? 'REFUNDED'
            : 'PARTIALLY_REFUNDED',
      },
    });

    this.eventEmitter.emit('payment.refunded', { payment, refund });

    return refund;
  }

  private getGateway(name: string) {
    switch (name.toLowerCase()) {
      case 'stripe':
        return this.stripeGateway;
      // case 'hyperpay':
      //   return this.hyperPayGateway;
      // case 'paytabs':
      //   return this.payTabsGateway;
      default:
        throw new BadRequestException('Unsupported gateway');
    }
  }

  private failPayment(paymentId: string, reason?: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: reason,
      },
    });
  }
}
```

---

## 🔌 **DAY 4: WEBHOOKS & CONTROLLER (4-5 hours)**

**File**: `apps/api/src/payments/payments.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payments')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPayment(@Body() body: any) {
    return this.paymentsService.createPayment(body);
  }

  @Post('refund/:paymentId')
  @UseGuards(JwtAuthGuard)
  async refundPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { amount: number; reason: string },
  ) {
    return this.paymentsService.refundPayment(
      paymentId,
      body.amount,
      body.reason,
    );
  }
}

// Webhooks controller (no auth - validated by signature)
@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('stripe')
  async stripeWebhook(
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.processWebhook('stripe', body, signature);
  }

  // Add more webhook endpoints for other gateways
}
```

---

## 🎨 **DAY 5: FRONTEND & TESTING (4-5 hours)**

### Payment Button Component

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function PaymentButton({ order }) {
  const [paying, setPaying] = useState(false);

  const paymentMutation = useMutation({
    mutationFn: (gateway: string) =>
      api.post('/payments', {
        orderId: order.id,
        amount: order.total,
        gateway,
        method: 'CREDIT_CARD',
      }),
    onSuccess: (payment) => {
      // Redirect to payment gateway
      window.location.href = payment.paymentUrl;
    },
  });

  return (
    <div className="space-y-3">
      <Button
        onClick={() => paymentMutation.mutate('stripe')}
        disabled={paymentMutation.isPending}
        className="w-full"
      >
        Pay with Card
      </Button>
    </div>
  );
}
```

---

## ✅ **COMPLETION CHECKLIST**

- [x] Payment gateway abstraction
- [x] Stripe integration
- [x] Webhook handling
- [x] Idempotency keys
- [x] Refund processing
- [x] Frontend payment button

---

**Congratulations!** 🎉 Payment system integrated!

**Next**: [PRD-013: Delivery Management →](./PRD_013_Delivery_Management_Implementation.md)
