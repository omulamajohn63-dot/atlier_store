import { DiscountCode } from '../types';

/**
 * Valid Boutique Promotional & Salon Privilege Codes (Kenyan Shillings)
 */
export const PROMOTIONAL_CODES: DiscountCode[] = [
  {
    code: 'MODEZA10',
    description: '10% Privileged Member Courtesy across all pieces',
    type: 'percentage',
    value: 10,
    minOrderAmount: 5000,
    isActive: true,
  },
  {
    code: 'KARIBU500',
    description: 'KSh 500 Welcome Voucher on your inaugural order',
    type: 'fixed',
    value: 500,
    minOrderAmount: 10000,
    isActive: true,
  },
  {
    code: 'SILK20',
    description: '20% off high-value orders over KSh 30,000',
    type: 'percentage',
    value: 20,
    minOrderAmount: 30000,
    maxDiscount: 10000,
    isActive: true,
  },
];
