export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
}

export interface ProductVariantDTO {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  colorHex?: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
  isActive: boolean;
}

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description: string;
  details?: string[];
  price: number;
  compareAtPrice?: number;
  category: { id: string; name: string; slug: string };
  images: string[];
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  variants: ProductVariantDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProductsResponse {
  data: ProductDTO[];
  pagination: PaginationMeta;
}

export interface CartItemDTO {
  id: string;
  productId: string;
  variantId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    image?: string;
    imageUrl?: string;
    images?: string[];
  };
  variant: { id: string; sku: string; size?: string; color?: string; stockQuantity: number };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartDTO {
  id: string;
  items: CartItemDTO[];
  subtotal: number;
  itemCount: number;
  currency: string;
}

export interface OrderItemDTO {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantSku: string;
  variantSize?: string;
  variantColor?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  cartId: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    county: string;
    postalCode?: string;
    deliveryInstructions?: string;
  };
  items: OrderItemDTO[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  shippingMethod: 'standard' | 'express';
  paymentMethod: 'mpesa' | 'card' | 'cash_on_delivery' | 'pay_on_delivery';
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'received' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentIntentId?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntentDTO {
  id: string;
  orderNumber: string;
  amount: number;
  currency: string;
  method: 'mpesa' | 'card';
  status: 'pending' | 'succeeded' | 'failed';
  clientSecret: string;
  gatewayReference?: string;
}

export interface ReceiptDTO {
  id: string;
  receiptNumber: string;
  orderNumber: string;
  status: 'generated' | 'failed';
  currency: string;
  amount: number;
  issueDate?: string;
  gatewayReference?: string;
  checkoutRequestId?: string;
  emailSentAt?: string;
  downloadPath: string;
  createdAt: string;
}
