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
  Menu,
  Package,
  Phone,
  ShieldCheck,
  Truck,
  UserRound,
  X,
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
import { motion, AnimatePresence } from 'motion/react';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E8E5DF] border-t-[#A2574F]" aria-hidden="true" />
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
          className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold uppercase tracking-[0.14em] text-[#63605A] transition-colors hover:text-[#181716] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Storefront
        </button>

        <div className="mt-8 rounded-3xl border border-[#E8E5DF] bg-white p-8 shadow-[0_20px_60px_rgba(24,23,22,0.05)] sm:p-10">
          <div className="space-y-2 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF9F6] ring-1 ring-[#E8E5DF]">
              <UserRound className="h-5 w-5 text-[#A2574F]" />
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
                        mode === m ? 'bg-[#A2574F] text-[#FAF9F6] shadow-xs' : 'text-[#63605A] hover:text-[#181716]'
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

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navigateAndCloseMobile = (path: string) => {
    navigate(path);
    closeMobileMenu();
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Mobile navigation button - only visible on mobile */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E8E5DF] bg-white px-4 py-3 text-left text-sm transition-colors hover:bg-[#FAF9F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63605A]">Account Menu</span>
          <Menu className="h-5 w-5 text-[#A2574F]" />
        </button>
      </div>

      {/* Desktop layout - grid only on lg+ */}
      <div className="hidden lg:grid lg:gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Desktop Sidebar */}
        <aside className="self-start lg:sticky lg:top-24 lg:col-span-1">
          <div className="overflow-hidden rounded-2xl border border-[#E8E5DF] bg-white shadow-xs">
            <div className="flex items-center gap-3.5 border-b border-[#F3F1ED] bg-[#FAF9F6] px-6 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#A2574F] font-serif text-base tracking-wide text-[#FAF9F6]">
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
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
                            active
                              ? 'bg-[#A2574F] text-[#FAF9F6] shadow-xs'
                              : 'text-[#63605A] hover:bg-[#FAF9F6] hover:text-[#181716]'
                          }`}
                        >
                          <span className={active ? 'text-[#FAF9F6]' : 'text-[#A2574F]'}>{icon}</span>
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
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63605A] transition-colors hover:bg-[#FDF2F2] hover:text-[#9E332B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
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

      {/* Mobile layout - single column, content first */}
      <div className="lg:hidden">
        <main className="min-w-0">
          {route.path === '/account/orders' && <AccountOrdersPage />}
          {route.path === '/account/notifications' && <AccountNotificationsPage />}
          {route.path === '/account/profile' && <AccountProfilePage />}
          {route.path === '/account/addresses' && <AccountAddressesPage />}
          {route.path === '/account/security' && <AccountSecurityPage />}
          {route.path === '/account' && <AccountOverviewPage />}
        </main>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] lg:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileMenu}
              className="absolute inset-0 bg-[#181716]/30 backdrop-blur-[2px]"
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative flex h-full w-[min(88vw,380px)] flex-col bg-[#FAF9F6] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#E8E5DF] px-6 py-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#827E77]">MODEZA</p>
                  <h2 className="mt-1 font-serif text-2xl text-[#181716]">Account</h2>
                </div>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="rounded-full p-2 text-[#63605A] hover:bg-[#F4ECE9] hover:text-[#181716] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-7">
                <div className="mb-6">
                  <div className="flex items-center gap-3.5 border-b border-[#F3F1ED] bg-white px-4 py-4 rounded-xl">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#A2574F] font-serif text-base tracking-wide text-[#FAF9F6]">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-serif text-lg leading-tight text-[#181716]">
                        {user.user_metadata?.full_name || 'MODEZA Client'}
                      </p>
                      <p className="truncate text-xs text-[#827E77]">{userEmail}</p>
                    </div>
                  </div>
                </div>
                <nav className="space-y-6" aria-label="Account navigation">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#827E77]">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {group.items.map(({ label, href, icon }) => {
                          const active = route.path === href;
                          return (
                            <button
                              key={href}
                              type="button"
                              onClick={() => navigateAndCloseMobile(href)}
                              aria-current={active ? 'page' : undefined}
                              className={`w-full rounded-xl px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
                                active
                                  ? 'bg-[#A2574F] text-[#FAF9F6] font-medium shadow-sm'
                                  : 'text-[#63605A] hover:bg-[#F4ECE9] hover:text-[#181716]'
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <span className={active ? 'text-[#FAF9F6]' : 'text-[#A2574F]'}>{icon}</span>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
                <div className="mt-8 pt-6 border-t border-[#E8E5DF]">
                  <button
                    type="button"
                    onClick={() => {
                      void signOut();
                      closeMobileMenu();
                    }}
                    className="w-full rounded-xl px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] text-[#9E332B] hover:bg-[#FDF2F2] flex items-center gap-3"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};