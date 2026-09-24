import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Lock, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AccountPageHeader } from '../components/account/AccountPageHeader';
import { Button } from '../components/modeza/Button';
import { Badge } from '../components/modeza/Badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/modeza/Card';
import { Input } from '../components/modeza/Input';

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AccountPageHeader
          eyebrow="Account"
          title="Security"
          description="Keep your boutique account safe and protected."
        />
        <Badge variant={isConfigured ? 'success' : 'warning'} size="lg" className="w-fit gap-1.5">
          {isConfigured ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
          {isConfigured ? 'Protected account' : 'Preview mode'}
        </Badge>
      </div>

      <Card className="overflow-hidden border-[#E8E5DF]">
        <form onSubmit={handleSubmit}>
          <CardHeader className="flex-row items-start gap-4 border-b border-[#F3F1ED] p-5 sm:p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4ECE9] text-[#A2574F] ring-1 ring-[#E8E5DF]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <CardTitle>Change password</CardTitle>
                <Badge variant="outline" size="sm">Password</Badge>
              </div>
              <CardDescription className="mt-1.5 max-w-xl">Choose a strong, unique password for your MODEZA account.</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Input
                id="current-password"
                name="currentPassword"
                label="Current password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                className="sm:col-span-2 lg:col-span-1"
              />
              <Input
                id="new-password"
                name="newPassword"
                label="New password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
                helperText="At least 8 characters."
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              />
              <Input
                id="confirm-password"
                name="confirmPassword"
                label="Confirm new password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                className="sm:col-span-2 lg:col-span-1"
              />
            </div>
          </CardContent>

          <CardFooter className="flex-col items-start gap-3 border-t border-[#F3F1ED] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="max-w-xl text-xs leading-relaxed text-[#63605A]">
              {isConfigured
                ? 'You will be asked to confirm your identity before the change takes effect.'
                : 'Account access is not configured in this preview, so password changes are unavailable.'}
            </p>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              disabled={!isConfigured || !user}
              className="w-full gap-2 uppercase tracking-wider text-xs sm:w-auto"
              aria-label="Update password"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Update Password
            </Button>
          </CardFooter>
        </form>
      </Card>

      {message && (
        <Card
          className={message.type === 'success' ? 'border-[#C8D8CA] bg-[#F2F6F2]' : 'border-[#F8B4B4] bg-[#FDF2F2]'}
          role={message.type === 'success' ? 'status' : 'alert'}
          aria-live={message.type === 'success' ? 'polite' : 'assertive'}
        >
          <CardContent className="flex items-start gap-3 p-4 sm:p-5">
            {message.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2E5A44]" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9E332B]" aria-hidden="true" />
            )}
            <p className={`text-sm leading-relaxed ${message.type === 'success' ? 'text-[#2E5A44]' : 'text-[#9E332B]'}`}>{message.text}</p>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-[#E8E5DF]">
        <CardHeader className="flex-row items-start gap-4 p-5 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4ECE9] text-[#A2574F] ring-1 ring-[#E8E5DF]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle>Two-step verification</CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl">Not yet available for boutique accounts — we'll notify members when it launches.</CardDescription>
          </div>
        </CardHeader>
        <CardFooter className="justify-end border-t border-[#F3F1ED] p-5 sm:p-6">
          <Badge variant="warning" size="lg" className="gap-1.5">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Coming Soon
          </Badge>
        </CardFooter>
      </Card>
    </section>
  );
};
