import React, { useState } from 'react';
import { useRouter } from '../router/RouterContext';
import { Button } from './ui/Button';
import { addNewsletterSubscriber } from '../utils/newsletter';
import { Sparkles, Truck, RotateCcw, ShieldCheck, Mail, MapPin, Phone, ArrowRight, Instagram, Twitter, Facebook, Youtube, CheckCircle2 } from 'lucide-react';

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

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    const result = addNewsletterSubscriber(newsletterEmail.trim());
    setNewsletterStatus(result.status);
    if (result.status === 'subscribed') {
      setNewsletterEmail('');
    }
  };

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

  return (
    <footer className="bg-[#FFFFFF] border-t border-[#E8E5DF] relative overflow-hidden">
      {/* Decorative gradient backdrop */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8A745C]/20 to-transparent" />
      <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-[#8A745C]/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand Philosophy */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-left font-serif text-2xl sm:text-3xl tracking-tight text-[#181716] block hover:text-[#8A745C] transition-colors"
              >
                ATELIER
              </button>
              <p className="text-sm text-[#63605A] leading-relaxed max-w-md">
                A modern fashion boutique dedicated to conscious luxury, timeless silhouettes,
                and ethical European craftsmanship. Every garment is produced in small, limited
                batches using certified sustainable fibers.
              </p>
            </div>

            {/* Value Props */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[#E8E5DF]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#8A745C] flex-shrink-0" />
                <span className="text-xs text-[#63605A]">Express Courier</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#8A745C] flex-shrink-0" />
                <span className="text-xs text-[#63605A]">30-Day Returns</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8A745C] flex-shrink-0" />
                <span className="text-xs text-[#63605A]">Secure Checkout</span>
              </div>
            </div>

            {/* Location & Contact */}
            <div className="space-y-3 pt-2 text-xs text-[#827E77]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Porto &bull; Paris &bull; New York</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <a href="mailto:concierge@atelier-boutique.com" className="hover:text-[#181716] transition-colors">
                  concierge@atelier-boutique.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>+351 220 000 000</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="pt-4 border-t border-[#E8E5DF]">
              <span className="text-[10px] uppercase tracking-widest font-semibold text-[#827E77] block mb-3">
                Follow the Atelier
              </span>
              <div className="flex gap-3">
                {socialLinks.map((social) => (
                  <span
                    key={social.label}
                    aria-label={social.label}
                    title={`${social.label} — shared profiles launch soon`}
                    className="w-9 h-9 rounded-full bg-[#FAF9F6] border border-[#E8E5DF] flex items-center justify-center text-[#A29E96]"
                  >
                    <social.icon className="w-4.5 h-4.5" />
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Collections */}
          <div className="space-y-4">
            <h5 className="text-xs uppercase tracking-widest font-semibold text-[#181716]">
              Collections
            </h5>
            <ul className="space-y-3">
              {footerLinks.collections.map((link) => (
                <li key={link.path || link.label}>
                  {link.path ? (
                    <button
                      onClick={() => navigate(link.path)}
                      className="w-full text-left text-sm text-[#63605A] hover:text-[#181716] transition-colors flex items-center justify-between group"
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#A29E96] group-hover:text-[#8A745C] group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
                    </button>
                  ) : (
                    <span className="text-sm text-[#827E77] cursor-default flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#A6937D]" />
                      {link.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Client Care */}
          <div className="space-y-4">
            <h5 className="text-xs uppercase tracking-widest font-semibold text-[#181716]">
              Client Care
            </h5>
            <ul className="space-y-3">
              {footerLinks.clientCare.map((link, index) => (
                <li key={index}>
                  {link.path ? (
                    <button
                      onClick={() => navigate(link.path)}
                      className={`w-full text-left text-sm transition-colors flex items-center justify-between group ${link.highlight ? 'font-medium text-[#181716] hover:text-[#8A745C]' : 'text-[#63605A] hover:text-[#181716]'}`}
                    >
                      <span>{link.label}</span>
                      <ArrowRight className={`w-3.5 h-3.5 transition-all ${link.highlight ? 'text-[#A29E96]' : 'text-[#A29E96] group-hover:text-[#8A745C] group-hover:translate-x-1 opacity-0 group-hover:opacity-100'}`} />
                    </button>
                  ) : (
                    <span className="text-sm text-[#827E77] cursor-default flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#A6937D]" />
                      {link.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h5 className="text-xs uppercase tracking-widest font-semibold text-[#181716]">
              The Atelier
            </h5>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.path || link.label}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="w-full text-left text-sm text-[#63605A] hover:text-[#181716] transition-colors flex items-center justify-between group"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#A29E96] group-hover:text-[#8A745C] group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="mt-12 lg:mt-16 p-6 lg:p-8 rounded-3xl bg-gradient-to-br from-[#FAF9F6] to-[#F3F1ED] border border-[#E8E5DF] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#8A745C]/5 via-transparent to-transparent" />
          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 space-y-3">
              <span className="text-xs uppercase tracking-widest font-semibold text-[#8A745C] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Private Salon & Capsule Drops
              </span>
              <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl text-[#181716] font-normal leading-tight">
                Join The Atelier Gazette
              </h3>
              <p className="text-sm text-[#63605A] max-w-md leading-relaxed">
                Subscribers receive private pre-order access 48 hours prior to public seasonal releases
                and invitations to atelier archive events.
              </p>
            </div>
            <div className="lg:col-span-1">
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto sm:mx-0"
              >
                <div className="relative w-full">
                  <Mail className="w-4.5 h-4.5 text-[#827E77] absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => {
                      setNewsletterEmail(e.target.value);
                      setNewsletterStatus('idle');
                    }}
                    placeholder="Enter your email address"
                    aria-label="Email address for The Atelier Gazette"
                    className="w-full pl-11 pr-4 py-3.5 bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl text-sm text-[#181716] placeholder-[#A29E96] focus:outline-none focus:border-[#181716] focus:ring-2 focus:ring-[#8A745C]/20 transition-all"
                  />
                </div>
                <Button variant="primary" size="md" type="submit" className="w-full sm:w-auto gap-2">
                  <span>Subscribe</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
              {newsletterStatus === 'idle' && (
                <p className="text-[11px] text-[#827E77] pt-2 text-center sm:text-left">
                  We respect your privacy. Unsubscribe at any moment.
                </p>
              )}
              {newsletterStatus === 'subscribed' && (
                <p className="text-[11px] leading-relaxed text-[#2E5A44] pt-2 text-center sm:text-left flex items-start justify-center sm:justify-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                  <span>
                    You're on the list. This preview save sign-ups on this device — live salon emails arrive once
                    the marketplace launches.
                  </span>
                </p>
              )}
              {newsletterStatus === 'duplicate' && (
                <p className="text-[11px] text-[#63605A] pt-2 text-center sm:text-left flex items-start justify-center sm:justify-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-[#8A745C]" aria-hidden="true" />
                  <span>This email is already on the Gazette list.</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-[#F3F1ED] pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A29E96]">Legal</span>
            {footerLinks.legal.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="text-xs text-[#827E77] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] rounded-sm"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="border-t border-[#F3F1ED] mt-6 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#827E77]">
          <p>&copy; {new Date().getFullYear()} ATELIER Prêt-à-Porter. All rights reserved.</p>
          <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-end">
            <button onClick={() => navigate('/')} className="hover:text-[#181716] transition-colors flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Storefront
            </button>
            <button onClick={() => navigate('/shop')} className="hover:text-[#181716] transition-colors flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Catalogue
            </button>
            <a href={adminUrl} className="hover:text-[#181716] transition-colors flex items-center gap-1" target="_blank" rel="noreferrer">
              <MapPin className="w-3.5 h-3.5" />
              Staff Portal
            </a>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
              <span>Made with</span>
              <span className="text-[#9E332B]">♥</span>
              <span>in Portugal</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};