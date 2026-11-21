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

/**
 * AutomationSection — fused container for Cron + Hooks & Webhooks.
 *
 * Both subdomains are about "the system reacts to events or runs on
 * a schedule", so they share a Settings entry. Each child is wrapped
 * in a SettingsBlock so the user can collapse one and focus on the
 * other.
 *
 * The original CronConfigSection and HooksSection components are
 * still exported and reused as-is to minimise risk and keep their
 * own internal logic intact (their own dirty/save flows live inside).
 */

import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { useUiPreferencesStore } from '@/stores/ui-preferences.store';
import { DEFAULT_AUTOMATION_EXPANDED } from '@/services/ui-preferences.service';
import { SettingsBlock } from '../shared/SettingsBlock';
import { CronConfigSection } from './CronConfigSection';
import { HooksSection } from './HooksSection';

export function AutomationSection() {
  const { t } = useI18n();
  const userId = useAuthStore(state => state.user?.id ?? null);
  const generation = useAuthStore(state => state.sessionGeneration);
  const { userId: preferenceOwner, preferences, ready, saving, error, refresh, setAutomationExpanded } = useUiPreferencesStore();
  const sessionKey = `${userId ?? 'signed-out'}:${generation}`;
  const owned = !!userId && preferenceOwner === userId;
  const initial = owned && ready ? preferences.automation ?? DEFAULT_AUTOMATION_EXPANDED : DEFAULT_AUTOMATION_EXPANDED;
  const [view, setView] = useState({ ...initial, sessionKey, initialized: owned && ready });
  const localView = useRef(view);

  useEffect(() => {
    const current = localView.current.sessionKey === sessionKey ? localView.current : { ...DEFAULT_AUTOMATION_EXPANDED, sessionKey, initialized: false };
    if (localView.current.sessionKey !== sessionKey) { localView.current = current; setView(current); }
    if (!owned || current.initialized || !ready && !error) return;
    // A failed preference read keeps the ordinary forms usable with this
    // session's temporary view. A later retry must not discard their drafts.
    const next = { ...(ready ? preferences.automation ?? DEFAULT_AUTOMATION_EXPANDED : current), sessionKey, initialized: true };
    localView.current = next; setView(next);
  }, [sessionKey, owned, ready, error, preferences.automation]);

  const expanded = view.sessionKey === sessionKey ? view : DEFAULT_AUTOMATION_EXPANDED;
  const interactive = owned && view.sessionKey === sessionKey && view.initialized;
  const toggle = (panel: 'cron' | 'hooks') => {
    const actual = useAuthStore.getState();
    if (!owned || actual.user?.id !== userId || actual.sessionGeneration !== generation || useUiPreferencesStore.getState().userId !== userId) return;
    const current = localView.current.sessionKey === sessionKey ? localView.current : { ...DEFAULT_AUTOMATION_EXPANDED, sessionKey, initialized: false };
    const next = { ...current, [panel]: !current[panel] };
    localView.current = next; setView(next); setAutomationExpanded(panel, next[panel]);
  };

  return (
    <div key={sessionKey}>
      <h2
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 4px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {t('settings.automation.title')}
      </h2>
      <p
        style={{
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          margin: '0 0 16px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {t('settings.automation.description')}
      </p>
      {(error || saving || !owned || !ready) && <p role="status" className="mb-3 text-xs text-[var(--text-muted)]">
        {error || t(saving ? 'settings.automation.savingPreferences' : 'settings.automation.loadingPreferences')}
        {error && <button type="button" className="ml-2 underline" disabled={saving} onClick={() => void refresh()}>{t('settings.automation.retry')}</button>}
      </p>}

      <SettingsBlock
        title={t('settings.automation.cron.title')}
        description={t('settings.automation.cron.description')}
        expanded={expanded.cron}
        onToggle={() => toggle('cron')}
      >
        <div style={{ marginTop: 4 }}>
          <>{interactive ? <CronConfigSection /> : <p role="status">{t('settings.automation.loadingPreferences')}</p>}</>
        </div>
      </SettingsBlock>

      <SettingsBlock
        title={t('settings.automation.hooks.title')}
        description={t('settings.automation.hooks.description')}
        expanded={expanded.hooks}
        onToggle={() => toggle('hooks')}
      >
        <div style={{ marginTop: 4 }}>
          <>{interactive ? <HooksSection /> : <p role="status">{t('settings.automation.loadingPreferences')}</p>}</>
        </div>
      </SettingsBlock>
    </div>
  );
}
