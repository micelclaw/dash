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
import { KeyRound, RefreshCw } from 'lucide-react';
import * as apiKeysSvc from '@/services/api-keys.service';
import type { ApiKey } from '@/services/api-keys.service';
import { SettingSection } from '../SettingSection';
import { useI18n } from '@/i18n';

export function MyApiKeysSection() {
  const { t, locale } = useI18n();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setKeys(await apiKeysSvc.listMyApiKeys());
    } catch {
      // endpoint may not be available
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingSection
      title={t('settings.myApiKeys.title')}
      description={t('settings.myApiKeys.description')}
      action={
        <button onClick={load} className="p-1.5 rounded hover:bg-[var(--surface-hover)]" title={t('settings.myApiKeys.refresh')} aria-label={t('settings.myApiKeys.refresh')}>
          <RefreshCw size={14} className={`text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {loading ? null : keys.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          <KeyRound size={24} className="mx-auto mb-2 opacity-40" />
          {t('settings.myApiKeys.empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(key => (
            <div key={key.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <KeyRound size={14} className="text-[var(--text-muted)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text)]">{key.label}</div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span className="font-mono">{key.key_prefix}...</span>
                  {key.scope && (
                    <span className="flex gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{key.scope}</span>
                    </span>
                  )}
                  {key.last_used_at && <span>{t('settings.myApiKeys.lastUsed', { date: new Date(key.last_used_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US') })}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingSection>
  );
}
