import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Facebook,
  Heart,
  Instagram,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  Twitter,
  Youtube,
} from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { addNewsletterSubscriber } from '../utils/newsletter';
import { Button, Card, Input } from './modeza';

export const Footer: React.FC = () => {
  const { navigate } = useRouter();
  const adminUrl = import.meta.env.VITE_ADMIN_URL || 'http://127.0.0.1:8000/admin/dashboard/';
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'subscribed' | 'duplicate'>('idle');

  const socialLinks = [
    { icon: Instagram, label: 'Instagram' },
    { icon: Twitter, label: 'Twitter' },
    { icon: Facebook, label: 'Facebook' },
    { icon: Youtube, label: 'YouTube' },
  ];

  const footerLinks = {
    collections: [
      { label: 'All Pieces', path: '/shop' },
      { label: 'Silk Dresses', path: '/shop/dresses' },
      { label: 'Tops & Knitwear', path: '/shop/tops' },
      { label: 'Tailored Trousers', path: '/shop/bottoms' },
      { label: 'Wool Outerwear', path: '/shop/outerwear' },
      { label: 'Artisanal Leather', path: '/shop/accessories' },
    ],
    clientCare: [
      { label: 'Track Order', path: '/track', highlight: true },
      { label: 'Cart', path: '/cart' },
      { label: 'Direct Checkout', path: '/checkout' },
      { label: 'Complimentary 30-Day Returns', path: null },
      { label: 'Carbon-Neutral Delivery', path: null },
    ],
    company: [
      { label: 'Our Story', path: '/about' },
      { label: 'Sustainability', path: '/about#sustainability' },
      { label: 'Craftsmanship', path: '/about#craftsmanship' },
      { label: 'Careers', path: '/about#careers' },
      { label: 'Press', path: '/about#press' },
    ],
    legal: [
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Terms of Service', path: '/terms' },
      { label: 'Shipping & Delivery', path: '/shipping' },
      { label: 'Returns & Exchanges', path: '/returns' },
      { label: 'Cookie Policy', path: '/cookies' },
    ],
  };

  const handleNewsletterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newsletterEmail.trim()) return;
    const result = addNewsletterSubscriber(newsletterEmail.trim());
    setNewsletterStatus(result.status);
    if (result.status === 'subscribed') {
      setNewsletterEmail('');
    }
  };

  const statusDescriptionId = newsletterStatus === 'idle'
    ? 'newsletter-privacy'
    : 'newsletter-status';

  return (
    <footer className="relative overflow-hidden border-t border-[#E8E5DF] bg-white">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#A2574F]/30 to-transparent" aria-hidden="true" />
      <div className="absolute left-1/4 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-[#A2574F]/30 to-transparent" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-12">
          <div className="space-y-6 lg:col-span-2">
            <div className="max-w-xl space-y-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="block rounded-sm text-left font-serif text-2xl tracking-tight text-[#181716] transition-colors hover:text-[#A2574F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-offset-4 sm:text-3xl"
              >
                MODEZA
              </button>
              <p className="text-sm leading-relaxed text-[#63605A]">
                A modern fashion boutique dedicated to conscious luxury, timeless silhouettes,
                and ethical European craftsmanship. Every garment is produced in small, limited
                batches using certified sustainable fibers.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-[#E8E5DF] pt-5 sm:grid-cols-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-[#A2574F]" aria-hidden="true" />
                <span className="text-xs text-[#63605A]">Express Courier</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 shrink-0 text-[#A2574F]" aria-hidden="true" />
                <span className="text-xs text-[#63605A]">30-Day Returns</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#A2574F]" aria-hidden="true" />
                <span className="text-xs text-[#63605A]">Secure Checkout</span>
              </div>
            </div>

            <div className="space-y-3 pt-1 text-xs text-[#827E77]">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Porto &bull; Paris &bull; New York</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <a
                  href="mailto:concierge@modeza-boutique.com"
                  className="rounded-sm transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
                >
                  concierge@modeza-boutique.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>+351 220 000 000</span>
              </div>
            </div>

            <div className="border-t border-[#E8E5DF] pt-5">
              <span className="mb-3 block text-[10px] font-semibold uppercase tracking-widest text-[#827E77]">
                Follow the MODEZA
              </span>
              <div className="flex gap-3">
                {socialLinks.map((social) => (
                  <span
                    key={social.label}
                    role="img"
                    aria-label={`${social.label} profile coming soon`}
                    title={`${social.label} — shared profiles launch soon`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E8E5DF] bg-[#FAF9F6] text-[#A29E96]"
                  >
                    <social.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                ))}
              </div>
            </div>
          </div>

          <FooterLinkGroup
            title="Collections"
            links={footerLinks.collections}
            onNavigate={navigate}
          />
          <FooterLinkGroup
            title="Client Care"
            links={footerLinks.clientCare}
            onNavigate={navigate}
          />
          <FooterLinkGroup
            title="The MODEZA"
            links={footerLinks.company}
            onNavigate={navigate}
          />
        </div>

        <Card className="relative mt-12 overflow-hidden rounded-3xl border border-[#E8E5DF] bg-gradient-to-br from-[#FAF9F6] to-[#F3F1ED] p-0 shadow-none lg:mt-16">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#A2574F]/5 via-transparent to-transparent" aria-hidden="true" />
          <div className="relative grid grid-cols-1 items-center gap-6 p-6 lg:grid-cols-3 lg:p-8">
            <div className="space-y-3 lg:col-span-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#A2574F]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Private Salon &amp; Capsule Drops
              </span>
              <h2 className="font-serif text-xl font-normal leading-tight text-[#181716] sm:text-2xl lg:text-3xl">
                Join The MODEZA Gazette
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-[#63605A]">
                Subscribers receive private pre-order access 48 hours prior to public seasonal releases
                and invitations to MODEZA archive events.
              </p>
            </div>

            <div className="lg:col-span-1">
              <form
                onSubmit={handleNewsletterSubmit}
                className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 sm:mx-0 sm:flex-row"
              >
                <div className="relative w-full min-w-0">
                  <Input
                    id="newsletter-email"
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(event) => {
                      setNewsletterEmail(event.target.value);
                      setNewsletterStatus('idle');
                    }}
                    placeholder="Enter your email address"
                    aria-label="Email address for The MODEZA Gazette"
                    aria-describedby={statusDescriptionId}
                    icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    className="h-12 py-3.5 pl-10"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full shrink-0 gap-2 sm:w-auto"
                >
                  Subscribe
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>

              {newsletterStatus === 'idle' && (
                <p id="newsletter-privacy" className="pt-2 text-center text-[11px] text-[#827E77] sm:text-left">
                  We respect your privacy. Unsubscribe at any moment.
                </p>
              )}
              {newsletterStatus === 'subscribed' && (
                <p
                  id="newsletter-status"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-start justify-center gap-1.5 pt-2 text-center text-[11px] leading-relaxed text-[#2E5A44] sm:justify-start sm:text-left"
                >
                  <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    You&apos;re on the list. This preview saves sign-ups on this device; live salon emails arrive once
                    the marketplace launches.
                  </span>
                </p>
              )}
              {newsletterStatus === 'duplicate' && (
                <p
                  id="newsletter-status"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-start justify-center gap-1.5 pt-2 text-center text-[11px] leading-relaxed text-[#63605A] sm:justify-start sm:text-left"
                >
                  <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-[#A2574F]" aria-hidden="true" />
                  <span>This email is already on the Gazette list.</span>
                </p>
              )}
            </div>
          </div>
        </Card>

        <div className="mt-12 border-t border-[#F3F1ED] pt-6">
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3" aria-label="Legal">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A29E96]">Legal</span>
            {footerLinks.legal.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                className="rounded-sm text-xs text-[#827E77] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-offset-2"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[#F3F1ED] pt-8 text-xs text-[#827E77] sm:flex-row">
          <p>&copy; {new Date().getFullYear()} MODEZA Prêt-à-Porter. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-5 sm:justify-end sm:gap-6">
            <FooterUtilityLink label="Storefront" onClick={() => navigate('/')}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            </FooterUtilityLink>
            <FooterUtilityLink label="Catalogue" onClick={() => navigate('/shop')}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </FooterUtilityLink>
            <a
              href={adminUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-sm transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Staff Portal
            </a>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
              <span>Made with</span>
              <Heart className="h-3 w-3 fill-[#9E332B] text-[#9E332B]" aria-hidden="true" />
              <span>in Portugal</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

interface FooterLinkItem {
  label: string;
  path: string | null;
  highlight?: boolean;
}

const FooterLinkGroup: React.FC<{
  title: string;
  links: FooterLinkItem[];
  onNavigate: (path: string) => void;
}> = ({ title, links, onNavigate }) => (
  <nav aria-label={title}>
    <h2 className="text-xs font-semibold uppercase tracking-widest text-[#181716]">{title}</h2>
    <ul className="mt-4 space-y-3">
      {links.map((link) => (
        <li key={link.path || link.label}>
          {link.path ? (
            <button
              type="button"
              onClick={() => onNavigate(link.path as string)}
              className={`group flex w-full items-center justify-between rounded-sm text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
                link.highlight
                  ? 'font-medium text-[#181716] hover:text-[#A2574F]'
                  : 'text-[#63605A] hover:text-[#181716]'
              }`}
            >
              <span>{link.label}</span>
              <ArrowRight
                className={`h-3.5 w-3.5 shrink-0 text-[#A29E96] transition-all group-hover:translate-x-1 group-hover:text-[#A2574F] ${
                  link.path && !link.highlight ? 'opacity-0 group-hover:opacity-100' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span className="flex cursor-default items-center gap-1 text-sm text-[#827E77]">
              {title === 'Client Care' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-[#C0857B]" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-[#C0857B]" aria-hidden="true" />
              )}
              {link.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  </nav>
);

const FooterUtilityLink: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1 rounded-sm transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
  >
    {children}
    {label}
  </button>
);
