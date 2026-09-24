import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Home, MapPin, Phone, Save, UserRound } from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { KENYA_COUNTIES, KENYA_COUNTY_SUBCOUNTIES } from '../data/kenyaLocations';
import { upsertAddress } from '../utils/addressBook';
import { AccountPageHeader } from '../components/account/AccountPageHeader';

export const ProfileCompletionPage: React.FC = () => {
  const { navigate, route } = useRouter();
  const { user, isConfigured, updateProfile } = useAuth();

  const [step, setStep] = useState<'profile' | 'address'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [county, setCounty] = useState('');
  const [subcounty, setSubcounty] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country] = useState('Kenya');

  const counties = KENYA_COUNTIES;
  const subcounties = county ? KENYA_COUNTY_SUBCOUNTIES[county] || [] : [];

  useEffect(() => {
    if (!user) {
      navigate('/account');
      return;
    }

    if (user.user_metadata?.full_name && user.user_metadata?.phone) {
      setStep('address');
    }
  }, [user, navigate]);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsLoading(true);

    const result = await updateProfile({
      fullName: fullName.trim(),
      phone: phone.trim(),
    });

    if (result.error) {
      setMessage({ type: 'error', text: result.error });
      setIsLoading(false);
      return;
    }

    setStep('address');
    setIsLoading(false);
  };

  const handleAddressSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsLoading(true);

    if (!user) {
      setMessage({ type: 'error', text: 'Session expired. Please sign in again.' });
      setIsLoading(false);
      return;
    }

    const addressData = {
      label: 'Home',
      firstName: fullName.split(' ')[0] || '',
      lastName: fullName.split(' ').slice(1).join(' ') || '',
      phone,
      addressLine1,
      addressLine2,
      county,
      subcounty,
      city,
      postalCode,
      country,
      isDefault: true,
    };

    try {
      upsertAddress(user.id, addressData);
      setMessage({ type: 'success', text: 'Profile completed successfully!' });

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save address. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipAddress = () => {
    navigate('/');
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E8E5DF] border-t-[#A2574F]" aria-hidden="true" />
        <p className="mt-4 text-sm text-[#827E77]" role="status">Loading...</p>
      </div>
    );
  }

  const isProfileComplete = user.user_metadata?.full_name && user.user_metadata?.phone;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
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
            Complete Your Profile
          </p>
          <h1 className="font-serif text-3xl tracking-tight text-[#181716]">
            {step === 'profile' ? 'Tell us about yourself' : 'Add a delivery address'}
          </h1>
          <p className="text-sm text-[#63605A]">
            {step === 'profile'
              ? 'This helps us personalize your experience and speed up checkout.'
              : 'Save an address so future checkout is a single tap.'}
          </p>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-center gap-2 mb-6" role="progressbar" aria-valuenow={step === 'profile' ? 1 : 2} aria-valuemin={1} aria-valuemax={2}>
            <div className={`flex h-2 w-24 rounded-full transition-colors ${step === 'profile' ? 'bg-[#A2574F]' : 'bg-[#A2574F]'}`} />
            <div className={`flex h-2 w-24 rounded-full transition-colors ${step === 'address' ? 'bg-[#A2574F]' : 'bg-[#E8E5DF]'}`} />
          </div>
          <div className="flex justify-center gap-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#827E77]">
            <span className={step === 'profile' ? 'text-[#A2574F]' : ''}>Profile</span>
            <span className={step === 'address' ? 'text-[#A2574F]' : ''}>Address</span>
          </div>

          {message && (
            <p className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-[#C8D8CA] bg-[#F2F6F2] text-[#2E5A44]'
                : 'border-[#F8B4B4] bg-[#FDF2F2] text-[#9E332B]'
            }`} role={message.type === 'success' ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}

          {step === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
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
              <Button type="submit" isLoading={isLoading} className="w-full uppercase tracking-wider text-xs">
                Continue
              </Button>
            </form>
          )}

          {step === 'address' && (
            <form onSubmit={handleAddressSubmit} className="mt-6 space-y-4">
              <Input
                label="Street address"
                type="text"
                required
                placeholder="14 Riverside Drive, Westlands"
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                autoComplete="street-address"
                icon={<MapPin className="h-4 w-4" />}
              />
              <Input
                label="Apartment, suite, etc. (optional)"
                type="text"
                placeholder="Apt 4B, Building C"
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
                autoComplete="address-line2"
                icon={<MapPin className="h-4 w-4" />}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#63605A]">County</label>
                  <select
                    required
                    value={county}
                    onChange={(event) => {
                      setCounty(event.target.value);
                      setSubcounty('');
                      setCity('');
                    }}
                    className="flex h-11 w-full rounded-xl border border-[#E8E5DF] bg-white px-3 text-sm text-[#181716] placeholder:text-[#C4C0B8] transition-colors focus:border-[#A2574F] focus:outline-none focus:ring-2 focus:ring-[#A2574F]/20"
                  >
                    <option value="" disabled>Select county</option>
                    {counties.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#63605A]">Sub-county</label>
                  <select
                    required
                    disabled={!county}
                    value={subcounty}
                    onChange={(event) => setSubcounty(event.target.value)}
                    className={`flex h-11 w-full rounded-xl border px-3 text-sm transition-colors focus:border-[#A2574F] focus:outline-none focus:ring-2 focus:ring-[#A2574F]/20 ${
                      county ? 'bg-white text-[#181716]' : 'bg-[#FAF9F6] text-[#C4C0B8] cursor-not-allowed'
                    }`}
                  >
                    <option value="" disabled>Select sub-county</option>
                    {subcounties.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City / Town"
                  type="text"
                  required
                  placeholder="Westlands"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  autoComplete="address-level2"
                  disabled={!subcounty}
                />
                <Input
                  label="Postal code"
                  type="text"
                  placeholder="00100"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  autoComplete="postal-code"
                />
              </div>

              <div className="mt-7 flex flex-col items-start gap-3 border-t border-[#F3F1ED] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-[#63605A]">
                  We'll save this as your default delivery address.
                </p>
                <div className="flex w-full gap-3 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipAddress}
                    className="w-full justify-center gap-2 uppercase tracking-wider text-xs sm:w-auto"
                  >
                    Skip for now
                  </Button>
                  <Button type="submit" isLoading={isLoading} className="w-full justify-center gap-2 uppercase tracking-wider text-xs sm:w-auto">
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    Complete Setup
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-[#827E77]">
        By continuing, you agree to MODEZA&apos;s <a href="/terms" className="underline hover:text-[#181716]">Terms</a> and <a href="/privacy" className="underline hover:text-[#181716]">Privacy Policy</a>.
      </p>
    </div>
  );
};