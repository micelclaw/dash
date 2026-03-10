import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { EmailAccount } from '../types';
import type { ApiListResponse } from '@/types/api';

export function useEmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(() => {
    api.get<ApiListResponse<EmailAccount>>('/email-accounts')
      .then(res => setAccounts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const getDefaultAccount = () => accounts.find(a => a.is_default) || accounts[0];
  const getAccountById = (id: string) => accounts.find(a => a.id === id);

  return { accounts, loading, getDefaultAccount, getAccountById, refetch: fetchAccounts };
}
