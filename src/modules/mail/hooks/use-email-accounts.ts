import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { EmailAccount } from '../types';
import type { ApiListResponse } from '@/types/api';

export function useEmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiListResponse<EmailAccount>>('/email-accounts')
      .then(res => setAccounts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getDefaultAccount = () => accounts.find(a => a.is_default) || accounts[0];
  const getAccountById = (id: string) => accounts.find(a => a.id === id);

  return { accounts, loading, getDefaultAccount, getAccountById };
}
