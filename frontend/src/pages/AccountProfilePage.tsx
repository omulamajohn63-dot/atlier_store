import React, { useEffect, useState } from 'react';
import { Mail, Phone, Save, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AccountPageHeader } from '../components/account/AccountPageHeader';

export const AccountProfilePage: React.FC = () => {
  const { user, isConfigured, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.user_metadata?.full_name || '');
    setPhone(user.user_metadata?.phone || '');
  }, [user]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    const result = await updateProfile({ fullName: fullName.trim(), phone: phone.trim() });
    setMessage(
      result.error ? { type: 'error', text: result.error } : { type: 'success', text: 'Profile details updated.' }
    );
    setIsSaving(false);
  };

  return (
    <section className="w-full space-y-6">
      <AccountPageHeader
        eyebrow="Account"
        title="Personal Information"
        description="The details the modeza uses for orders and correspondence."
      />

      <form onSubmit={handleSave} className="rounded-2xl border border-[#E8E5DF] bg-white p-6 shadow-xs sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Full name"
            type="text"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            icon={<UserRound className="h-4 w-4" />}
          />
          <Input
            label="Phone number"
            type="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            icon={<Phone className="h-4 w-4" />}
          />
        </div>

        <div className="mt-5">
          <Input
            label="Email address"
            type="email"
            disabled
            value={user?.email || ''}
            helperText="Your sign-in email cannot be changed here."
            icon={<Mail className="h-4 w-4" />}
          />
        </div>

        <div className="mt-7 flex flex-col items-start gap-3 border-t border-[#F3F1ED] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-[#63605A]">
            Saved instantly to your MODEZA member profile.
          </p>
          <Button type="submit" isLoading={isSaving} disabled={!isConfigured} className="w-full justify-center gap-2 uppercase tracking-wider text-xs sm:w-auto">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Save Profile
          </Button>
        </div>
      </form>

      {message &&
        (message.type === 'success' ? (
          <p className="rounded-xl border border-[#C8D8CA] bg-[#F2F6F2] px-4 py-3 text-sm text-[#2E5A44]" role="status">
            {message.text}
          </p>
        ) : (
          <p className="rounded-xl border border-[#F8B4B4] bg-[#FDF2F2] px-4 py-3 text-sm text-[#9E332B]" role="alert">
            {message.text}
          </p>
        ))}
    </section>
  );
};