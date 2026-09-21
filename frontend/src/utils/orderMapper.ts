import { Order, OrderStatus, ShippingAddress } from '../types';
import { OrderDTO } from '../types/api';

/**
 * Maps a server OrderDTO onto the domain Order used by the orders UI.
 * Source of truth for every server-backed order surface so mapping stays DRY.
 */
export function mapServerOrder(serverOrder: OrderDTO): Order {
  const nameParts = (serverOrder.customer.fullName || '').split(' ').filter(Boolean);

  const customer: ShippingAddress = {
    firstName: nameParts[0] || serverOrder.customer.fullName || '',
    lastName: nameParts.slice(1).join(' ') || '',
    email: serverOrder.customer.email,
    phone: serverOrder.customer.phone,
    addressLine1: serverOrder.customer.addressLine1,
    addressLine2: serverOrder.customer.addressLine2 || '',
    city: serverOrder.customer.city,
    stateOrProvince: serverOrder.customer.county,
    postalCode: serverOrder.customer.postalCode || '',
    country: 'Kenya',
  };

  return {
    id: serverOrder.id,
    orderNumber: serverOrder.orderNumber,
    customer,
    items: serverOrder.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantDetails: `${item.variantSize || ''} ${item.variantColor || ''}`.trim(),
      sku: item.variantSku,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.lineTotal,
      image: item.imageUrl || '',
    })),
    subtotal: serverOrder.subtotal,
    shippingMethod: serverOrder.shippingMethod,
    shippingCost: serverOrder.shippingCost,
    tax: serverOrder.tax,
    total: serverOrder.total,
    status: serverOrder.status,
    paymentStatus: serverOrder.paymentStatus,
    paymentMethod: serverOrder.paymentMethod,
    notes: serverOrder.customer.deliveryInstructions,
    timeline: [
      {
        status: 'confirmed' as OrderStatus,
        title: 'Order Authorized & Received',
        description: 'Order registered in the modeza order ledger.',
        timestamp: serverOrder.createdAt,
        completed: true,
      },
      {
        status: 'processing' as OrderStatus,
        title: 'MODEZA Preparation',
        description: 'The order is being prepared for delivery.',
        timestamp: serverOrder.updatedAt,
        completed: serverOrder.status !== 'pending',
      },
    ],
    createdAt: serverOrder.createdAt,
    updatedAt: serverOrder.updatedAt,
  };
}

/** Total units across an order's items (quantity-aware). */
export function totalQuantity(order: { items: { quantity: number }[] }): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Locale-aware date formatting used across the orders experience. */
export function formatOrderDate(iso: string | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-KE', opts);
}