import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import { flutterwavePaymentService, SubscriptionStatus } from '../services/flutterwavePaymentService';

interface SubscriptionContextValue {
  status: SubscriptionStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  requireActive: (onLocked?: () => void) => Promise<boolean>;
  markActiveForDebug: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const live = await flutterwavePaymentService.getSubscriptionStatus(token);
      setStatus(live);
      await SecureStore.setItemAsync('sub_status', JSON.stringify(live));
    } catch {
      // fallback to cached
      const cached = await SecureStore.getItemAsync('sub_status');
      if (cached) setStatus(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(load, [load]);

  const requireActive = useCallback(async (onLocked?: () => void) => {
    if (!status?.active) {
      onLocked && onLocked();
      return false;
    }
    return true;
  }, [status]);

  const markActiveForDebug = useCallback(async () => {
    const fake: SubscriptionStatus = { active: true, expiresAt: new Date(Date.now()+27*24*3600*1000).toISOString() };
    setStatus(fake);
    await SecureStore.setItemAsync('sub_status', JSON.stringify(fake));
  }, []);

  const value = useMemo(() => ({ status, loading, refresh, requireActive, markActiveForDebug }), [status, loading, refresh, requireActive, markActiveForDebug]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
