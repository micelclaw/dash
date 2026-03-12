/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

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
