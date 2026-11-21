import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { selectLocale, translate, type MessageValues } from './core';
export { hasMessage, normalizeLocale, selectLocale, translate, validateCatalogs } from './core';
export type { Locale, Messages, MessageValues } from './core';

export function useI18n() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const generation = useAuthStore((s) => s.sessionGeneration);
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const language = useSettingsStore((s) => s.serverSettings?.general.language);
  const owner = useSettingsStore((s) => s.ownerSession);
  const locale = selectLocale(authenticated, `${userId}:${generation}`, owner, language);
  const t = useCallback((key: string, values?: MessageValues) => translate(locale, key, values), [locale]);
  return { locale, t };
}

/** Keeps the document language aligned for assistive technology. */
export function useDocumentLocale() {
  const { locale } = useI18n();
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
}
