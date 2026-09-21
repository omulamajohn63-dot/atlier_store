import { db } from '../db/database';
import { PaymentIntentDTO, OrderDTO } from '../types/api';
import { CreatePaymentIntentInput, ConfirmPaymentInput, PaymentWebhookInput, MpesaCallbackInput } from '../schemas/payment.schema';
import { NotFoundError, AppError, UnauthorizedError, ConflictError } from '../errors/app-error';
import { PricingService } from './pricing.service';
import { OrderService } from './order.service';
import { config } from '../config';
import { MpesaService } from './mpesa.service';

export class PaymentService {
  private static readonly WEBHOOK_SECRET = config.PAYMENT_WEBHOOK_SECRET;

  /**
   * Creates a payment intent bound to the authoritative order total in minor currency units.
   */
  public static async createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentDTO> {
    const order = db.getOrderByNumber(input.orderNumber);
    if (!order) {
      throw new NotFoundError('Order', input.orderNumber);
    }

    if (order.paymentStatus === 'paid') {
      throw new ConflictError('ORDER_ALREADY_PAID', `Order ${input.orderNumber} is already settled.`);
    }

    const intentId = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let clientSecret = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 16)}`;
    let providerReference: string | undefined;
    let metadata: Record<string, unknown> = {
      customerEmail: order.customer.email,
      phone: input.phoneNumber || order.customer.phone,
      mode: 'local-fallback',
    };

    if (input.method === 'mpesa' && MpesaService.isConfigured) {
      const stk = await MpesaService.initiateStkPush({
        amount: order.totalMinor / 100,
        phoneNumber: input.phoneNumber || order.customer.phone,
        accountReference: order.orderNumber,
        transactionDescription: `MODEZA order ${order.orderNumber}`,
      });
      clientSecret = stk.checkoutRequestId;
      providerReference = stk.merchantRequestId;
      metadata = { ...metadata, mode: 'daraja', customerMessage: stk.customerMessage };
    }

    const intent = db.createPaymentIntent({
      id: intentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountMinor: order.totalMinor,
      currency: 'KES',
      method: input.method,
      status: 'pending',
      clientSecret,
      gatewayReference: providerReference,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    db.updateOrderPaymentStatus(order.id, 'pending', intentId);

    return {
      id: intent.id,
      orderNumber: intent.orderNumber,
      amount: PricingService.minorToMajor(intent.amountMinor),
      currency: intent.currency,
      method: intent.method,
      status: intent.status,
      clientSecret: intent.clientSecret,
      gatewayReference: intent.gatewayReference || providerReference,
    };
  }

  /**
   * Confirms payment intent and transitions order status to confirmed and paid.
   */
  public static confirmPayment(input: ConfirmPaymentInput): OrderDTO {
    return db.transaction(() => {
      const order = db.getOrderByNumber(input.orderNumber);
      if (!order) {
        throw new NotFoundError('Order', input.orderNumber);
      }

      const intent = db.getPaymentIntentById(input.paymentIntentId);
      if (!intent) {
        throw new NotFoundError('PaymentIntent', input.paymentIntentId);
      }

      if (intent.orderNumber !== order.orderNumber) {
        throw new AppError(400, 'INTENT_MISMATCH', 'Payment intent does not belong to this order.');
      }

      const gatewayRef = input.gatewayReference || `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      db.updatePaymentIntentStatus(intent.id, 'succeeded', gatewayRef);
      for (const reservation of db.getReservationsByOrderId(order.id)) {
        if (reservation.status === 'active') {
          db.updateReservationStatus(reservation.id, 'committed');
        }
      }
      const updatedOrder = db.updateOrderPaymentStatus(order.id, 'paid', intent.id);

      return OrderService.toDTO(updatedOrder);
    });
  }

  /**
   * Secure Webhook handler for external payment gateways (Stripe, M-Pesa Daraja, etc.).
   * Enforces cryptographic / secret signature verification before applying state transitions.
   */
  public static processWebhook(
    payload: PaymentWebhookInput,
    signatureHeader?: string
  ): { received: boolean; status: string; orderNumber?: string } {
    // 1. Signature Verification
    if (!signatureHeader || signatureHeader.trim() !== this.WEBHOOK_SECRET) {
      throw new UnauthorizedError('Invalid or missing webhook verification signature.');
    }

    // 2. Transactional Event Processing
    return db.transaction(() => {
      const { event, data } = payload;
      const targetOrderNumber = data.orderNumber;

      if (!targetOrderNumber) {
        return { received: true, status: 'ignored_missing_order_number' };
      }

      const order = db.getOrderByNumber(targetOrderNumber);
      if (!order) {
        throw new NotFoundError('Order', targetOrderNumber);
      }

      if (event === 'payment_intent.succeeded' || event === 'mpesa.stk_callback.success') {
        if (data.paymentIntentId) {
          db.updatePaymentIntentStatus(data.paymentIntentId, 'succeeded', data.transactionId);
        }
        for (const reservation of db.getReservationsByOrderId(order.id)) {
          if (reservation.status === 'active') {
            db.updateReservationStatus(reservation.id, 'committed');
          }
        }
        db.updateOrderPaymentStatus(order.id, 'paid', data.paymentIntentId);
        return { received: true, status: 'order_marked_paid', orderNumber: order.orderNumber };
      }

      if (event === 'payment_intent.payment_failed' || event === 'mpesa.stk_callback.failed') {
        if (data.paymentIntentId) {
          db.updatePaymentIntentStatus(data.paymentIntentId, 'failed', data.transactionId);
        }
        for (const reservation of db.getReservationsByOrderId(order.id)) {
          if (reservation.status === 'active') {
            db.incrementVariantStock(reservation.variantId, reservation.quantity);
            db.updateReservationStatus(reservation.id, 'released');
          }
        }
        db.updateOrderStatus(order.id, 'cancelled');
        db.updateOrderPaymentStatus(order.id, 'failed', data.paymentIntentId);
        return { received: true, status: 'order_marked_failed', orderNumber: order.orderNumber };
      }

      return { received: true, status: 'unhandled_event', orderNumber: order.orderNumber };
    });
  }

  public static processMpesaCallback(payload: MpesaCallbackInput): { received: boolean; status: string; orderNumber?: string } {
    const callback = payload.Body.stkCallback;
    const intent = db.getPaymentIntentByClientSecret(callback.CheckoutRequestID);
    if (!intent) {
      throw new NotFoundError('PaymentIntent', callback.CheckoutRequestID);
    }

    const items = callback.CallbackMetadata?.Item || [];
    const transactionId = items.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
    const amount = items.find((item) => item.Name === 'Amount')?.Value;
    const successful = callback.ResultCode === 0;

    return this.processWebhook(
      {
        event: successful ? 'mpesa.stk_callback.success' : 'mpesa.stk_callback.failed',
        data: {
          paymentIntentId: intent.id,
          orderNumber: intent.orderNumber,
          status: successful ? 'succeeded' : 'failed',
          transactionId: transactionId === undefined ? undefined : String(transactionId),
          amount: amount === undefined ? undefined : Number(amount),
          metadata: { resultCode: callback.ResultCode, resultDescription: callback.ResultDesc },
        },
      },
      this.WEBHOOK_SECRET
    );
  }
}
