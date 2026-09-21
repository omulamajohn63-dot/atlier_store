import React, { useState } from 'react';
import { Check, Lock, ShieldCheck, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AccountPageHeader } from '../components/account/AccountPageHeader';

export const AccountSecurityPage: React.FC = () => {
  const { user, isConfigured, updatePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword) {
      setMessage({ type: 'error', text: 'Please fill in every field.' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword === currentPassword) {
      setMessage({ type: 'error', text: 'New password must be different from the current one.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password confirmation does not match.' });
      return;
    }

    setIsSaving(true);
    const result = await updatePassword(currentPassword, newPassword);
    setMessage(
      result.error
        ? { type: 'error', text: result.error }
        : { type: 'success', text: 'Your password has been updated. Use it next time you sign in.' }
    );
    if (!result.error) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsSaving(false);
  };

  return (
    <section className="w-full space-y-6">
      <AccountPageHeader
        eyebrow="Account"
        title="Security"
        description="Keep your boutique account safe and protected."
      />

      <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E8E5DF] bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF9F6] ring-1 ring-[#E8E5DF]">
            <Lock className="h-5 w-5 text-[#8A745C]" />
          </span>
          <div>
            <h3 className="font-serif text-xl tracking-tight text-[#181716]">Change password</h3>
            <p className="mt-1 text-sm text-[#63605A]">
              Choose a strong, unique password for your MODEZA account.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Input
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
          />
          <div className="grid gap-5 sm:grid-cols-1">
            <Input
              label="New password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="••••••••"
              helperText="At least 8 characters."
              icon={<Lock className="h-4 w-4" />}
            />
          </div>
          <Input
            label="Confirm new password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
          />
        </div>

        <div className="mt-7 flex flex-col items-start gap-3 border-t border-[#F3F1ED] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-[#63605A]">
            {isConfigured
              ? 'You will be asked to confirm your identity before the change takes effect.'
              : 'Account access is not configured in this preview, so password changes are unavailable.'}
          </p>
          <Button
            type="submit"
            isLoading={isSaving}
            disabled={!isConfigured || !user}
            className="w-full justify-center gap-2 uppercase tracking-wider text-xs sm:w-auto"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Update Password
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

      <article className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E8E5DF] bg-white p-6 shadow-xs sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF9F6] ring-1 ring-[#E8E5DF]">
            <ShieldCheck className="h-5 w-5 text-[#8A745C]" />
          </span>
          <div>
            <h3 className="font-serif text-xl tracking-tight text-[#181716]">Two-step verification</h3>
            <p className="mt-1 text-sm text-[#63605A]">
              Not yet available for boutique accounts — we'll notify members when it launches.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E5DF] bg-[#FAF9F6] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#827E77]">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Coming Soon
        </span>
      </article>
    </section>
  );
};