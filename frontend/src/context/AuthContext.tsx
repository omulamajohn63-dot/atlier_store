import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; needsVerification?: boolean }>;
  signUp: (email: string, password: string, profile: { fullName: string; phone: string }) => Promise<{ error?: string; needsVerification?: boolean }>;
  updateProfile: (profile: { fullName: string; phone: string }) => Promise<{ error?: string }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Account access is not configured yet.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string, profile: { fullName: string; phone: string }) => {
    if (!supabase) return { error: 'Account access is not configured yet.' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/account`
          : undefined,
        data: {
          full_name: profile.fullName,
          phone: profile.phone,
        },
      },
    });
    return error
      ? { error: error.message }
      : { needsVerification: !data.session };
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  const updateProfile = async (profile: { fullName: string; phone: string }) => {
    if (!supabase) return { error: 'Account access is not configured yet.' };
    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: profile.fullName,
        phone: profile.phone,
      },
    });
    if (!error && data.user) setUser(data.user);
    return error ? { error: error.message } : {};
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!supabase) return { error: 'Account access is not configured yet.' };
    if (!user?.email) return { error: 'You must be signed in to change your password.' };

    // Verify the current password by re-authenticating before allowing the change.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return { error: 'Current password is incorrect.' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? { error: error.message } : {};
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isConfigured: Boolean(supabase), signIn, signUp, updateProfile, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
