import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import { useRouter } from '../router/RouterContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiClient';
import { audit } from '../lib/logger';
import { setPostAuthDestination } from '../utils/postAuthRedirect';
import { getSavedAddresses, SavedAddress } from '../utils/addressBook';
import { Button } from '../components/ui/Button';
import { Price } from '../components/ui/Price';
import {
  formatPrice,
  FREE_SHIPPING_THRESHOLD,
  EXPRESS_SHIPPING_COST,
  VAT_RATE,
} from '../utils/currency';
import {
  ShieldCheck,
  CreditCard,
  Truck,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Tag,
  MapPin,
  User,
  Smartphone,
  Package,
  Send,
} from 'lucide-react';
import {
  KENYA_COUNTIES,
  KENYA_COUNTY_SUBCOUNTIES,
  KENYA_SUBCOUNTY_CITIES,
} from '../data/kenyaLocations';
import { motion } from 'motion/react';

interface SectionCardProps {
  step: number;
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ step, title, icon, badge, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className="space-y-4 bg-[#FFFFFF] p-6 rounded-2xl border border-[#E8E5DF] shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center justify-between border-b border-[#F3F1ED] pb-4">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#181716] text-[#FAF9F6] text-xs font-bold">
          {step}
        </span>
        <h3 className="font-serif text-lg text-[#181716] font-medium">{title}</h3>
        {icon}
      </div>
      {badge && (
        <span className="text-xs text-[#827E77]">{badge}</span>
      )}
    </div>
    <div>{children}</div>
  </motion.div>
);

const LabeledInput: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({ label, name, value, onChange, type = 'text', placeholder, required, readOnly, disabled, icon }) => (
  <div>
    <label htmlFor={name} className="text-xs text-[#63605A] block mb-1.5 font-medium">
      {label} {required && <span className="text-[#9E332B]">*</span>}
    </label>
    <div className="relative">
      {icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#827E77] pointer-events-none">
          {icon}
        </div>
      )}
      <input
        id={name}
        type={type}
        name={name}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full py-2.5 bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl text-xs text-[#181716] placeholder-[#A29E96] focus:outline-none focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20 transition-all ${
          icon ? 'pl-10' : 'px-3.5'
        } ${readOnly ? 'bg-[#FAF9F6] text-[#827E77]' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  </div>
);

const LabeledSelect: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}> = ({ label, name, value, onChange, options, placeholder = 'Select...', required, disabled }) => (
  <div>
    <label htmlFor={name} className="text-xs text-[#63605A] block mb-1.5 font-medium">
      {label} {required && <span className="text-[#9E332B]">*</span>}
    </label>
    <div className="relative">
      <select
        id={name}
        name={name}
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className={`w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl text-xs text-[#181716] focus:outline-none focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20 transition-all appearance-none pr-10 cursor-pointer ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#827E77] pointer-events-none">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  </div>
);

export const CheckoutPage: React.FC = () => {
  const { cart, subtotal, discountAmount, appliedPromo, clearCart } = useCart();
  const { createOrder } = useOrders();
  const { navigate } = useRouter();
  const { user } = useAuth();

  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card' | 'cash_on_delivery' | 'pay_on_delivery'>('mpesa');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    country: 'Kenya',
    county: '',
    subcounty: '',
    city: '',
    postalCode: '',
    orderNotes: '',
    sameBilling: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [pendingOrderNumber, setPendingOrderNumber] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const addressPrefillApplied = useRef(false);

  const applySavedAddress = useCallback((address: SavedAddress) => {
    setFormData((prev) => ({
      ...prev,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      address: address.addressLine1,
      apartment: address.addressLine2,
      county: address.county,
      subcounty: address.subcounty,
      city: address.city,
      postalCode: address.postalCode,
    }));
  }, []);

  useEffect(() => {
    if (!user || addressPrefillApplied.current) return;
    const loaded = getSavedAddresses(user.id);
    setSavedAddresses(loaded);
    const defaultAddress = loaded.find((address) => address.isDefault) ?? loaded[0];
    if (defaultAddress) {
      applySavedAddress(defaultAddress);
    }
    addressPrefillApplied.current = true;
  }, [user, applySavedAddress]);

  useEffect(() => {
    if (!user) return;

    const meta = user.user_metadata ?? {};
    const firstNameMeta =
      (meta.first_name as string | undefined) ||
      (meta.given_name as string | undefined) ||
      '';
    const lastNameMeta =
      (meta.last_name as string | undefined) ||
      (meta.surname as string | undefined) ||
      (meta.family_name as string | undefined) ||
      '';
    const fullName =
      (meta.full_name as string | undefined) ||
      (meta.name as string | undefined) ||
      (user?.identities?.[0]?.identity_data?.full_name as string | undefined) ||
      '';

    const rawPhoneCandidates = [
      meta.phone as string | undefined,
      meta.telephone as string | undefined,
      meta.mobile as string | undefined,
    ];
    const phone = rawPhoneCandidates.find((candidate) => {
      if (!candidate || !candidate.trim()) return false;
      const normalized = candidate.replace(/[^+0-9\s().-]/g, '');
      return normalized.length >= 9 && normalized.length <= 18 && !/[a-z]/i.test(candidate);
    }) || '';

    const tokens = fullName.trim().split(/\s+/).filter(Boolean);
    const fallbackFirstName = tokens.shift() || '';
    const fallbackLastName = tokens.join(' ');

    setFormData((prev) => ({
      ...prev,
      email: user.email || prev.email,
      phone: phone || prev.phone,
      firstName: firstNameMeta || fallbackFirstName || prev.firstName,
      lastName: lastNameMeta || fallbackLastName || prev.lastName,
    }));
  }, [user]);

  // Shipping fee follows the requested 20% of cart subtotal rule, with a free-shipping
  // threshold still protecting the UI headline and cart upgrade copy.
  const deliveryCost = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD
    ? 0
    : Math.round(subtotal * 0.2);
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = Math.round(taxableSubtotal * VAT_RATE);
  const grandTotal = taxableSubtotal + deliveryCost + tax;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'county') {
        next.subcounty = '';
        next.city = '';
      }
      if (name === 'subcounty') {
        next.city = '';
      }
      return next;
    });
  };

  const subcountiesForCounty = KENYA_COUNTY_SUBCOUNTIES[formData.county] || [];
  const citiesForSubcounty = KENYA_SUBCOUNTY_CITIES[formData.subcounty] || (formData.subcounty ? [formData.subcounty] : []);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setPostAuthDestination('/checkout');
      navigate('/account');
      return;
    }
    setCheckoutError('');
    setIsSubmitting(true);

    try {
      void audit(
        'checkout_started',
        'Authorizing modeza order.',
        { payment_method: paymentMethod },
        {
          item_count: cart.length,
          total_minor: Math.round(grandTotal * 100),
        }
      );
      const result = await createOrder({
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          addressLine1: formData.address,
          addressLine2: formData.apartment,
          city: formData.city,
          stateOrProvince: formData.county,
          postalCode: formData.postalCode,
          country: formData.country,
        },
        items: cart,
        shippingMethod: deliveryMethod,
        paymentMethod,
        discountCode: appliedPromo ? appliedPromo.code : undefined,
        notes: formData.orderNotes,
      });

      if (result.success && result.order) {
        if (paymentMethod === 'cash_on_delivery' || paymentMethod === 'pay_on_delivery') {
          setIsSubmitting(false);
          await clearCart();
          navigate(`/order/success?order=${result.order.orderNumber}`);
          return;
        }

        if (paymentMethod === 'card') {
          const intent = await api.createPaymentIntent(
            result.order.orderNumber,
            'card',
            undefined
          );
          setPaymentIntentId(intent.id);
          setPendingOrderNumber(result.order.orderNumber);
          setPaymentPending(true);
          setIsSubmitting(false);
          return;
        }

        const intent = await api.createPaymentIntent(result.order.orderNumber, 'mpesa', formData.phone);
        setPaymentIntentId(intent.id);
        setPendingOrderNumber(result.order.orderNumber);
        setPaymentPending(true);
        setIsSubmitting(false);
      } else {
        setIsSubmitting(false);
        setCheckoutError(result.error || 'Failed to place order. Please check inventory levels.');
        void audit('checkout_failed', 'Order placement failed.', {}, { reason: result.error });
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setIsSubmitting(false);
      setCheckoutError(errorObj.message || 'An unexpected error occurred during checkout.');
      void audit('checkout_failed', 'Order placement failed.', {}, { message: errorObj.message });
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentIntentId || !pendingOrderNumber) return;

    setCheckoutError('');
    setIsSubmitting(true);
    try {
      const order = await api.confirmPayment(
        pendingOrderNumber,
        paymentIntentId
      );
      await clearCart();
      navigate(`/order/success?order=${order.orderNumber}`);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setCheckoutError(errorObj.message || 'Payment could not be confirmed. Please retry.');
      setIsSubmitting(false);
      void audit('payment_failed', 'Payment confirmation failed.', {}, { message: errorObj.message });
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] flex items-center justify-center mx-auto text-[#8A745C] mb-3">
          <ShoppingBagEmpty />
        </div>
        <h2 className="font-serif text-2xl text-[#181716]">No items in checkout</h2>
        <p className="text-sm text-[#63605A]">
          Your bag is empty. Please select pieces from the collection before proceeding to checkout.
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/shop')} className="gap-2">
          <span>Return to Shop</span>
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Checkout Progress Steps */}
      <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-6">
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className="text-xs font-semibold text-[#181716] hover:text-[#8A745C] flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Cart</span>
        </button>

        {/* Stepper */}
        <div className="hidden sm:flex items-center gap-2 text-xs">
          {[
            { label: 'Shipping', active: true, done: true },
            { label: 'Delivery', active: false, done: false },
            { label: 'Payment', active: false, done: false },
          ].map((step, index) => (
            <React.Fragment key={step.label}>
              <span
                className={`flex items-center gap-1.5 font-medium ${
                  step.active ? 'text-[#181716]' : 'text-[#827E77]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    step.done
                      ? 'bg-[#2E5A44] text-white'
                      : step.active
                      ? 'bg-[#181716] text-white'
                      : 'bg-[#EFECE6]'
                  }`}
                >
                  {index + 1}
                </span>
                {step.label}
              </span>
              {index < 2 && <span className="text-[#A29E96]">&rarr;</span>}
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#2E5A44] font-medium">
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Encrypted Checkout</span>
        </div>
      </div>

      {!user && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#E8E5DF] bg-[#FFFFFF] p-5 shadow-sm">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] flex items-center justify-center text-[#8A745C] shrink-0">
              <User className="w-4.5 h-4.5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#181716] uppercase tracking-wider">
                Sign in to place your order
              </p>
              <p className="text-xs text-[#63605A] mt-0.5">
                Your cart is saved. You will sign in before confirming your order and following delivery.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPostAuthDestination('/checkout');
              navigate('/account');
            }}
            className="shrink-0"
          >
            Sign In
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmitOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Main Form Fields (Col 7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Contact Info */}
            <SectionCard step={1} title="Contact Information" badge="Step 1 of 3" icon={<User className="w-4 h-4 text-[#8A745C]" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LabeledInput
                  label="Email Address"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  icon={<Send className="w-3.5 h-3.5" />}
                />
                <LabeledInput
                  label="Telephone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+254 7XX XXX XXX"
                  icon={<Smartphone className="w-3.5 h-3.5" />}
                />
              </div>
            </SectionCard>

            {/* 2. Shipping Address */}
            <SectionCard step={2} title="Shipping Destination" icon={<MapPin className="w-4 h-4 text-[#8A745C]" />}>
              {savedAddresses.length > 0 && (
                <div className="rounded-xl border border-[#E8E5DF] bg-[#FAF9F6] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#63605A]">
                      Saved Addresses
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/account/addresses')}
                      className="text-xs font-semibold text-[#8A745C] hover:text-[#6B5642] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] rounded-full px-2 py-1"
                    >
                      Manage
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      aria-label="Choose a saved address"
                      className="w-full sm:flex-1 px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl text-sm text-[#181716] focus:outline-none focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20 transition-all appearance-none pr-10 cursor-pointer"
                    >
                      <option value="" disabled>
                        Choose a saved address
                      </option>
                      {savedAddresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label || 'Saved Address'} — {address.addressLine1}, {address.city}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={!selectedAddressId}
                      onClick={() => {
                        const address = savedAddresses.find((a) => a.id === selectedAddressId);
                        if (address) applySavedAddress(address);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LabeledInput label="First Name" name="firstName" required value={formData.firstName} onChange={handleInputChange} placeholder="Jane" />
                <LabeledInput label="Last Name" name="lastName" required value={formData.lastName} onChange={handleInputChange} placeholder="Doe" />
              </div>

              <div className="space-y-4 mt-4">
                <LabeledInput label="Street Address" name="address" required value={formData.address} onChange={handleInputChange} placeholder="123 Moi Avenue" icon={<MapPin className="w-3.5 h-3.5" />} />
                <LabeledInput label="Apartment, Suite, Unit (Optional)" name="apartment" value={formData.apartment} onChange={handleInputChange} placeholder="Apt 4B" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <LabeledInput label="Country" name="country" required value={formData.country} onChange={handleInputChange} readOnly />
                <LabeledSelect
                  label="County"
                  name="county"
                  required
                  value={formData.county}
                  onChange={handleInputChange}
                  options={KENYA_COUNTIES}
                  placeholder="Select County"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <LabeledSelect
                  label="Subcounty"
                  name="subcounty"
                  required
                  value={formData.subcounty}
                  onChange={handleInputChange}
                  options={subcountiesForCounty}
                  placeholder="Select Subcounty"
                  disabled={!formData.county || subcountiesForCounty.length === 0}
                />
                <LabeledSelect
                  label="City"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleInputChange}
                  options={citiesForSubcounty}
                  placeholder="Select City"
                  disabled={!formData.subcounty || citiesForSubcounty.length === 0}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <LabeledInput label="Postal Code" name="postalCode" required value={formData.postalCode} onChange={handleInputChange} placeholder="00100" />
                <LabeledInput label="Phone Number" name="phone" type="tel" required value={formData.phone} onChange={handleInputChange} placeholder="+254 7XX XXX XXX" icon={<Smartphone className="w-3.5 h-3.5" />} />
              </div>
            </SectionCard>

            {/* 3. Delivery Method */}
            <SectionCard step={3} title="MODEZA Delivery Speed" icon={<Truck className="w-4 h-4 text-[#8A745C]" />}>
              <div className="space-y-3">
                {[
                  {
                    id: 'standard' as const,
                    title: 'Standard Carbon-Neutral Courier',
                    desc: '2–4 business days',
                    cost: deliveryCost,
                  },
                  {
                    id: 'express' as const,
                    title: 'Priority Dedicated Air Courier',
                    desc: 'Guaranteed next-day dispatch',
                    cost: EXPRESS_SHIPPING_COST,
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    role="radio"
                    aria-checked={deliveryMethod === opt.id}
                    onClick={() => setDeliveryMethod(opt.id)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      deliveryMethod === opt.id
                        ? 'border-[#181716] bg-[#FAF9F6] shadow-sm'
                        : 'border-[#E8E5DF] hover:border-[#181716] hover:bg-[#FAF9F6]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="delivery"
                        checked={deliveryMethod === opt.id}
                        onChange={() => setDeliveryMethod(opt.id)}
                        className="text-[#181716] focus:ring-[#8A745C]"
                      />
                      <div>
                        <span className="font-serif text-sm text-[#181716] font-medium block">
                          {opt.title}
                        </span>
                        <span className="text-xs text-[#827E77]">{opt.desc}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#181716]">
                      {opt.cost === 0 ? 'Complimentary' : formatPrice(opt.cost)}
                    </span>
                  </label>
                ))}
              </div>
            </SectionCard>

            {/* 4. Payment Section */}
            <SectionCard step={4} title="Payment Protocol" icon={<CreditCard className="w-4 h-4 text-[#8A745C]" />} badge={
              <span className="text-[11px] text-[#2E5A44] font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Stripe Prototype Sandbox</span>
              </span>
            }>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3" role="radiogroup" aria-label="Payment method">
                  {[
                    { id: 'mpesa' as const, label: 'M-Pesa' },
                    { id: 'card' as const, label: 'Card' },
                    { id: 'cash_on_delivery' as const, label: 'Cash on Delivery' },
                    { id: 'pay_on_delivery' as const, label: 'Pay on Delivery' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`rounded-xl border px-4 py-3 text-xs font-semibold transition-all ${
                        paymentMethod === method.id
                          ? 'border-[#181716] bg-[#181716] text-white shadow-md'
                          : 'border-[#E8E5DF] bg-[#FAF9F6] text-[#181716] hover:border-[#181716] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'card' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-[#E8E5DF] bg-[#FAF9F6] px-4 py-3.5 space-y-1.5"
                  >
                    <p className="text-[11px] leading-relaxed text-[#63605A]">
                      Card payments run in{' '}
                      <span className="font-semibold text-[#8A745C]">sandbox preview</span>:
                      this storefront does not yet connect a live card gateway, so no card details
                      are collected. Confirming the order completes it and marks it paid{' '}
                      <span className="font-semibold text-[#63605A]">without charging a real card</span>.
                    </p>
                  </motion.div>
                )}

                {paymentMethod !== 'card' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-[#E8E5DF] bg-[#FAF9F6] px-4 py-3 text-[11px] text-[#63605A] leading-relaxed"
                  >
                    {paymentMethod === 'cash_on_delivery'
                      ? 'Cash on delivery selected — the order will be paid when the courier delivers it.'
                      : paymentMethod === 'pay_on_delivery'
                      ? 'Pay on delivery selected — the order will be paid when the package is handed over.'
                      : 'M-Pesa selected — a payment prompt will be sent to your phone after placing the order.'}
                  </motion.div>
                )}

                <label className="flex items-center gap-2.5 text-xs text-[#63605A] pt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.sameBilling}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, sameBilling: e.target.checked }))
                    }
                    className="rounded text-[#181716] focus:ring-[#8A745C] cursor-pointer"
                  />
                  <span>Billing address matches shipping destination</span>
                </label>
              </div>
            </SectionCard>
          </div>

          {/* Sticky Order Summary Sidebar (Col 5) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8A745C]/20 to-transparent" />
              <h3 className="font-serif text-lg text-[#181716] font-medium border-b border-[#F3F1ED] pb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#8A745C]" />
                Order Review ({cart.length} items)
              </h3>

              {/* Items preview list */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3.5 hover:bg-[#FAF9F6] p-1.5 rounded-lg -m-1.5 transition-colors">
                    <div className="w-14 h-16 rounded-lg bg-[#EFECE6] overflow-hidden shrink-0 border border-[#E8E5DF]">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif text-xs text-[#181716] font-medium truncate">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-[#827E77] mt-0.5">
                        Size: {item.size} &bull; Qty: {item.quantity}
                      </p>
                    </div>
                    <Price amount={item.price * item.quantity} size="sm" />
                  </div>
                ))}
              </div>

              {/* Price summary */}
              <div className="space-y-3 text-xs text-[#63605A] border-t border-[#F3F1ED] pt-4">
                <div className="flex justify-between">
                  <span>Cart Subtotal</span>
                  <span className="text-[#181716] font-medium">{formatPrice(subtotal)}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-[#2E5A44]">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Privilege Code ({appliedPromo.code})</span>
                    </span>
                    <span className="font-medium">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery ({deliveryMethod === 'express' ? 'Priority Air' : 'Standard'})</span>
                  <span className="text-[#181716] font-medium">
                    {deliveryCost === 0 ? 'Complimentary' : formatPrice(deliveryCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated VAT (16%)</span>
                  <span className="text-[#181716] font-medium">{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between items-baseline text-base text-[#181716] font-serif font-medium border-t border-[#F3F1ED] pt-3 mt-3">
                  <span>Total Amount</span>
                  <span className="text-xl">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {checkoutError && (
                <div className="p-3.5 bg-[#FDF2F2] border border-[#F8B4B4] rounded-xl text-xs text-[#9B1C1C] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {paymentPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-[#F5F8F4] border border-[#C8D8CA] rounded-xl space-y-3"
                >
                  <div className="flex items-start gap-2 text-xs text-[#2E5A44]">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        {paymentMethod === 'card' ? 'Card payment intent created (sandbox)' : 'M-Pesa payment request sent'}
                      </p>
                      <p className="mt-1 text-[#4B6B57] leading-relaxed">
                        {paymentMethod === 'card'
                          ? 'No card will be charged — confirm below to complete the order in sandbox and mark it paid.'
                          : `Approve the prompt on ${formData.phone}, then confirm below.`}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={isSubmitting}
                    onClick={handleConfirmPayment}
                    className="w-full uppercase tracking-wider text-xs"
                  >
                    {isSubmitting
                      ? 'Checking Payment...'
                      : paymentMethod === 'card'
                      ? 'Confirm Sandbox Payment'
                      : 'I Have Completed Payment'}
                  </Button>
                </motion.div>
              )}

              {/* Submit CTA */}
              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting || paymentPending}
                  className="w-full uppercase tracking-wider text-xs shadow-md hover:shadow-lg"
                >
                  {isSubmitting ? 'Authorizing MODEZA Order...' : paymentPending ? 'Payment Pending' : `Authorize & Place Order • ${formatPrice(grandTotal)}`}
                </Button>

                <p className="text-[11px] text-[#827E77] text-center leading-relaxed">
                  By clicking Place Order, you confirm acceptance of our Conditions of Sale and European
                  cancellation rights.
                </p>

                <div className="flex items-center justify-center gap-2 text-[11px] text-[#827E77] pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8A745C]" />
                  <span>256-Bit SSL Encrypted Transaction</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

// Small helper for empty cart illustration
const ShoppingBagEmpty: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-7 h-7"
  >
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);