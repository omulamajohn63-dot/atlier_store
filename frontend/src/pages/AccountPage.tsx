import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Heart,
  History,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useAuth } from '../context/AuthContext';
import { consumePostAuthDestination } from '../utils/postAuthRedirect';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AccountOverviewPage } from './AccountOverviewPage';
import { AccountOrdersPage } from './AccountOrdersPage';
import { AccountNotificationsPage } from './AccountNotificationsPage';
import { AccountProfilePage } from './AccountProfilePage';
import { AccountAddressesPage } from './AccountAddressesPage';
import { AccountSecurityPage } from './AccountSecurityPage';

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_GROUPS: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Account',
    items: [
      { label: 'Overview', href: '/account', icon: <UserRound className="h-4 w-4" /> },
      { label: 'Orders', href: '/account/orders', icon: <Package className="h-4 w-4" /> },
      { label: 'Notifications', href: '/account/notifications', icon: <Bell className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Personal Info', href: '/account/profile', icon: <UserRound className="h-4 w-4" /> },
      { label: 'Addresses', href: '/account/addresses', icon: <MapPin className="h-4 w-4" /> },
      { label: 'Security', href: '/account/security', icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Storefront',
    items: [
      { label: 'Track Order', href: '/track', icon: <Truck className="h-4 w-4" /> },
      { label: 'Wishlist', href: '/wishlist', icon: <Heart className="h-4 w-4" /> },
      { label: 'Recently Viewed', href: '/recently-viewed', icon: <History className="h-4 w-4" /> },
    ],
  },
];

const FLAT_NAV = NAV_GROUPS.flatMap((group) => group.items);

export const AccountPage: React.FC = () => {
  const { navigate, route } = useRouter();
  const { user, isLoading, isConfigured, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.user_metadata?.full_name || '');
    setPhone(user.user_metadata?.phone || '');
  }, [user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    const result =
      mode === 'signIn'
        ? await signIn(email, password)
        : await signUp(email, password, { fullName, phone });
    if (!result.error && !result.needsVerification) {
      const destination = consumePostAuthDestination();
      if (destination) {
        navigate(destination);
        return;
      }
    }
    setMessage(
      result.error ||
        (result.needsVerification
          ? 'Check your email to verify your account.'
          : 'Welcome back to MODEZA.')
    );
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E8E5DF] border-t-[#8A745C]" aria-hidden="true" />
        <p className="mt-4 text-sm text-[#827E77]" role="status">Loading account...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold uppercase tracking-[0.14em] text-[#63605A] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Storefront
        </button>

        <div className="mt-8 rounded-3xl border border-[#E8E5DF] bg-white p-8 shadow-[0_20px_60px_rgba(24,23,22,0.05)] sm:p-10">
          <div className="space-y-2 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF9F6] ring-1 ring-[#E8E5DF]">
              <UserRound className="h-5 w-5 text-[#8A745C]" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#827E77]">
              MODEZA Member
            </p>
            <h1 className="font-serif text-3xl tracking-tight text-[#181716]">
              {mode === 'signIn' ? 'Welcome back' : 'Join the MODEZA'}
            </h1>
            <p className="text-sm text-[#63605A]">
              {mode === 'signIn'
                ? 'Sign in to follow your orders and save your details.'
                : 'Save your details and follow every order in one place.'}
            </p>
          </div>

          <div className="mt-7">
            {!isConfigured ? (
              <div className="space-y-4">
                <p className="rounded-xl border border-[#E8D7A8] bg-[#FFF8E8] p-4 text-sm leading-6 text-[#9B6B20]">
                  Account access will be available once Supabase browser credentials are configured.
                </p>
                <Button type="button" onClick={() => navigate('/')} className="w-full uppercase tracking-wider text-xs">
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 rounded-full border border-[#E8E5DF] bg-[#FAF9F6] p-1">
                  {(['signIn', 'signUp'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m);
                        setMessage('');
                      }}
                      className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                        mode === m ? 'bg-[#181716] text-[#FAF9F6] shadow-xs' : 'text-[#63605A] hover:text-[#181716]'
                      }`}
                    >
                      {m === 'signIn' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>

                {message && (
                  <p className="mt-5 rounded-xl border border-[#E8E5DF] bg-[#FAF9F6] px-4 py-3 text-sm text-[#63605A]" role="status">
                    {message}
                  </p>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {mode === 'signUp' && (
                    <>
                      <Input
                        label="Full name"
                        type="text"
                        required
                        placeholder="Elena Wambui"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        icon={<UserRound className="h-4 w-4" />}
                      />
                      <Input
                        label="Phone number"
                        type="tel"
                        required
                        placeholder="+254 700 000 000"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        autoComplete="tel"
                        icon={<Phone className="h-4 w-4" />}
                      />
                    </>
                  )}
                  <Input
                    label="Email address"
                    type="email"
                    required
                    placeholder="you@modeza.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    icon={<Mail className="h-4 w-4" />}
                  />
                  <Input
                    label="Password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                    icon={<Lock className="h-4 w-4" />}
                  />
                  <Button type="submit" isLoading={isSubmitting} className="w-full uppercase tracking-wider text-xs">
                    {mode === 'signIn' ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                    setMessage('');
                  }}
                  className="mt-5 w-full text-xs text-[#63605A] transition-colors hover:text-[#181716]"
                >
                  {mode === 'signIn' ? 'New to MODEZA? Create an account' : 'Already have an account? Sign in'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const firstName = (user.user_metadata?.full_name || '').split(' ')[0] || 'MODEZA Client';
  const userEmail = user.email || user.user_metadata?.email || '';
  const initials = (firstName.charAt(0) + (user.user_metadata?.full_name?.split(' ')[1]?.charAt(0) || '')).toUpperCase() || userEmail.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        {/* Sidebar */}
        <aside className="self-start lg:sticky lg:top-24 lg:col-span-1">
          {/* Mobile nav */}
          <div className="lg:hidden">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Account sections">
              {FLAT_NAV.map(({ label, href }) => {
                const active = route.path === href;
                return (
                  <button
                    key={href}
                    type="button"
                    onClick={() => navigate(href)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                      active
                        ? 'border-[#181716] bg-[#181716] text-[#FAF9F6]'
                        : 'border-[#E8E5DF] bg-white text-[#63605A] hover:text-[#181716]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop card */}
          <div className="hidden overflow-hidden rounded-2xl border border-[#E8E5DF] bg-white shadow-xs lg:block">
            <div className="flex items-center gap-3.5 border-b border-[#F3F1ED] bg-[#FAF9F6] px-6 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#181716] font-serif text-base tracking-wide text-[#FAF9F6]">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-lg leading-tight text-[#181716]">
                  {user.user_metadata?.full_name || 'MODEZA Client'}
                </p>
                <p className="truncate text-xs text-[#827E77]">{userEmail}</p>
              </div>
            </div>

            <nav className="space-y-6 p-4" aria-label="Account navigation">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A29E96]">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(({ label, href, icon }) => {
                      const active = route.path === href;
                      return (
                        <button
                          key={href}
                          type="button"
                          onClick={() => navigate(href)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C] ${
                            active
                              ? 'bg-[#181716] text-[#FAF9F6] shadow-xs'
                              : 'text-[#63605A] hover:bg-[#FAF9F6] hover:text-[#181716]'
                          }`}
                        >
                          <span className={active ? 'text-[#CBB896]' : 'text-[#8A745C]'}>{icon}</span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-[#F3F1ED] p-4">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63605A] transition-colors hover:bg-[#FDF2F2] hover:text-[#9E332B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A745C]"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          {route.path === '/account/orders' && <AccountOrdersPage />}
          {route.path === '/account/notifications' && <AccountNotificationsPage />}
          {route.path === '/account/profile' && <AccountProfilePage />}
          {route.path === '/account/addresses' && <AccountAddressesPage />}
          {route.path === '/account/security' && <AccountSecurityPage />}
          {route.path === '/account' && <AccountOverviewPage />}
        </main>
      </div>
    </div>
  );
};