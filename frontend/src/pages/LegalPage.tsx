import React from 'react';
import { useRouter } from '../router/RouterContext';
import { Button } from '../components/ui/Button';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export type LegalSlug = 'privacy' | 'terms' | 'shipping' | 'returns' | 'cookies';

interface LegalSection {
  heading: string;
  body: string;
  bullets?: string[];
}

interface LegalDocument {
  title: string;
  eyebrow: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocument> = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Client data & transparency',
    updated: 'Last updated September 2026',
    intro:
      'MODEZA retains only the information needed to fulfil orders, deliver parcels, issue receipts, and care for its clients. This policy explains what we hold, why, and how you can control it.',
    sections: [
      {
        heading: 'Information we collect',
        body: 'We collect details you provide when placing an order or creating an account — including your name, email address, phone number, and delivery address. We also record browsing history (such as recently viewed pieces) on your device so you can return to items easily.',
        bullets: [
          'Account details kept in your device-local profile (this preview build stores accounts, carts, and address books locally unless a Supabase backend is configured).',
          'Order information, stored to display order status and tracking.',
          'Payment method selection. Card and M-Pesa details are handled at the gateway; we never store full card numbers.',
        ],
      },
      {
        heading: 'How we use information',
        body: 'Your information supports order fulfilment, delivery updates, customer service, and, with consent, private salon announcements. We do not sell personal data to third parties.',
      },
      {
        heading: 'Your choices',
        body: 'You can unsubscribe from salon messages at any time, clear your browsing history, and request correction or deletion of stored data by contacting concierge@modeza-boutique.com.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    eyebrow: 'Boutique shopping agreement',
    updated: 'Last updated September 2026',
    intro:
      'These terms govern your use of the MODEZA boutique storefront and the purchase of our garments. By placing an order you accept these terms.',
    sections: [
      {
        heading: 'Orders & pricing',
        body: 'All prices are in Kenyan Shillings (KES). The final total shown at checkout includes the prevailing value-added tax, delivery, and any Privilege discount applied. An order is confirmed when you receive an order number from MODEZA.',
        bullets: [
          'Prices and availability are correct at the time of display but may change without notice.',
          'Payment methods available include M-Pesa, card, cash on delivery, and pay on delivery.',
          'A confirmed order reserves modeza stock; cancellation is available only for pending or confirmed orders.',
        ],
      },
      {
        heading: 'Eligibility',
        body: 'The storefront is available to customers with a valid delivery address in Kenya. Creating an account is required to place an order so that parcels can be tracked securely.',
      },
      {
        heading: 'Our responsibility',
        body: 'We produce garments in small batches and inspect each piece before dispatch. Liability is limited to the value of the goods purchased; nothing in these terms limits rights that cannot be excluded by law.',
      },
    ],
  },
  shipping: {
    title: 'Shipping & Delivery',
    eyebrow: 'Carbon-neutral delivery',
    updated: 'Last updated September 2026',
    intro:
      'Every parcel travels carbon-neutral, from artisan cutting to handover. We calculate delivery by the delivery method selected at checkout.',
    sections: [
      {
        heading: 'Delivery options',
        body: 'Standard delivery is charged at 20% of the cart subtotal, while express (Priority Air) delivery carries a higher fee. Delivery is complimentary on qualifying orders above the free-shipping threshold shown during checkout.',
        bullets: [
          'Standard — usually 2–4 working days within major Kenyan counties.',
          'Express Priority Air — usually 1–2 working days.',
          'Orders are shipped from our Kenyan fulfillment modeza after payment or, for pay-on-delivery, at handover.',
        ],
      },
      {
        heading: 'Tracking',
        body: 'Every order receives a reference code you can track at any time from Track Order. Status milestones are shown as they are confirmed by our fulfillment team — we never invent tracking events.',
      },
      {
        heading: 'Delivery area',
        body: 'We currently deliver across Kenya. If your county is not yet served, we will let you know before dispatch.',
      },
    ],
  },
  returns: {
    title: 'Returns & Exchanges',
    eyebrow: 'Complimentary 30-day returns',
    updated: 'Last updated September 2026',
    intro:
      'If a piece is not right for you, return it within 30 days of delivery for a refund or exchange. Garments must be unworn, unwashed, and in their original tissue wrapping.',
    sections: [
      {
        heading: 'How to return',
        body: 'Contact concierge@modeza-boutique.com within 30 days of delivery and we will arrange collection. Refunds to the original payment method are issued once the garment passes inspection.',
        bullets: [
          'M-Pesa and card returns are processed to the account used for payment.',
          'Cash-on-delivery returns can be refunded to a chosen M-Pesa number.',
          'Return shipping is complimentary for standard-sized parcels.',
        ],
      },
      {
        heading: 'Exchanges',
        body: 'Prefer a different size or silhouette? We will prioritise an exchange before refunding, subject to availability.',
      },
      {
        heading: 'Exclusions',
        body: 'Altered garments, underwear, and sale pieces marked final are excluded from returns. This does not affect your statutory rights.',
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    eyebrow: 'How this storefront stores data',
    updated: 'Last updated September 2026',
    intro:
      'This preview storefront keeps the smallest footprint possible. This page explains the storage we use in plain language.',
    sections: [
      {
        heading: 'What we store',
        body: 'Rather than third-party advertising cookies, MODEZA uses local device storage for a handful of essential conveniences:',
        bullets: [
          'Recent activity — recently viewed pieces, saved on your device only.',
          'Membership — account session, address book, and wishlist stored locally (or via your configured Supabase account).',
          'Cart persistence — so your bag survives a refresh.',
        ],
      },
      {
        heading: 'No tracking for ads',
        body: 'We do not install advertising or cross-site tracking cookies. Analytics, if introduced, will be privacy-conscious and declared here.',
      },
      {
        heading: 'Managing storage',
        body: 'You can clear storage anytime from your browser settings, or use the Clear history action on the Recently Viewed page.',
      },
    ],
  },
};

export const LegalPage: React.FC<{ slug: LegalSlug }> = ({ slug }) => {
  const { navigate } = useRouter();
  const document = LEGAL_DOCUMENTS[slug];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#63605A] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] rounded-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Storefront
      </button>

      <header className="mt-10 border-b border-[#E8E5DF] pb-8">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A2574F]">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {document.eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#181716] sm:text-5xl">
          {document.title}
        </h1>
        <p className="mt-3 text-xs text-[#827E77]">{document.updated}</p>
        <p className="mt-5 text-sm leading-relaxed text-[#63605A]">{document.intro}</p>
      </header>

      <div className="mt-10 space-y-8">
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-serif text-2xl tracking-tight text-[#181716]">{section.heading}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#63605A]">{section.body}</p>
            {section.bullets && (
              <ul className="mt-4 space-y-2.5">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#63605A]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A2574F]" aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-[#E8E5DF] bg-[#FAF9F6] p-6 text-center">
        <p className="text-sm text-[#63605A]">
          Questions? Contact{' '}
          <a href="mailto:concierge@modeza-boutique.com" className="font-medium text-[#A2574F] hover:text-[#83443D] transition-colors">
            concierge@modeza-boutique.com
          </a>
        </p>
      </div>
    </div>
  );
};