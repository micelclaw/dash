import { Link } from 'react-router';
import { useUiPreferencesStore } from '@/stores/ui-preferences.store';
import { useI18n } from '@/i18n';

export function UiPreferencesNotice() {
  const { t } = useI18n();
  const ready = useUiPreferencesStore(state => state.ready);
  const legacy = useUiPreferencesStore(state => state.legacy);
  const decision = useUiPreferencesStore(state => state.legacyDecision);
  if (!ready || !legacy || decision !== 'pending') return null;
  return <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--text-muted)]">
    <span>{t('settings.preferences.legacyNotice')}</span>
    <Link className="font-medium text-[var(--amber)] underline underline-offset-2" to="/settings/configuration-migration">{t('settings.preferences.legacyReview')}</Link>
  </div>;
}
