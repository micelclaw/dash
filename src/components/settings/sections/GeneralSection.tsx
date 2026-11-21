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

import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import {SettingSearchSelect} from '../SettingSearchSelect';
import { SaveBar } from '../SaveBar';
import { useI18n } from '@/i18n';
import { languageOptions } from '@/i18n/languages';

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

/**
 * Compute the current UTC offset of an IANA timezone using Intl.
 * Returns the offset in minutes (signed) and a pretty label like
 * `UTC+2` / `UTC-5` / `UTC+5:30`. Honors DST as of "now".
 */
function getTimezoneOffset(tz: string): { mins: number; label: string } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = fmt.formatToParts(new Date());
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    // offsetPart looks like "GMT", "GMT+2", "GMT-5", "GMT+5:30"
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetPart);
    if (!m || !m[1] || !m[2]) return { mins: 0, label: 'UTC' };
    const signChar = m[1];
    const sign = signChar === '+' ? 1 : -1;
    const h = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    const totalMins = sign * (h * 60 + mm);
    const minStr = mm > 0 ? `:${String(mm).padStart(2, '0')}` : '';
    return { mins: totalMins, label: `UTC${signChar}${h}${minStr}` };
  } catch {
    return { mins: 0, label: 'UTC' };
  }
}

// Computed once per page load — there are ~400 IANA zones, so we
// avoid recomputing on every render. The offsets themselves are
// DST-aware as of the moment the page loaded; refreshing the page
// re-evaluates them, which is good enough for a settings dropdown.
let TIMEZONE_OPTIONS_CACHE: Array<{ value: string; label: string }> | null = null;

function getTimezoneOptions(): Array<{ value: string; label: string }> {
  if (TIMEZONE_OPTIONS_CACHE) return TIMEZONE_OPTIONS_CACHE;
  let zones: string[];
  try {
    zones = (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch {
    zones = ['UTC', 'America/New_York', 'Europe/London', 'Europe/Madrid', 'Asia/Tokyo'];
  }
  TIMEZONE_OPTIONS_CACHE = [...new Set(['UTC',...zones])].map((tz) => {
    const { label: offset } = getTimezoneOffset(tz);
    return { value: tz, label: `(${offset}) ${tz.replace(/_/g, ' ')}` };
  });
  return TIMEZONE_OPTIONS_CACHE;
}

function formatPreview(dateFormat: string, timeFormat: string): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  let datePart: string;
  if (dateFormat === 'DD/MM/YYYY') datePart = `${day}/${month}/${year}`;
  else if (dateFormat === 'MM/DD/YYYY') datePart = `${month}/${day}/${year}`;
  else datePart = `${year}-${month}-${day}`;

  const hours = timeFormat === '12h'
    ? ((now.getHours() % 12) || 12)
    : now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const suffix = timeFormat === '12h' ? (now.getHours() >= 12 ? ' PM' : ' AM') : '';
  const timePart = `${String(hours).padStart(2, '0')}:${mins}${suffix}`;

  return `${datePart} ${timePart}`;
}

export function GeneralSection({ initialSetup = false }: {initialSetup?: boolean} = {}) {
  const { t } = useI18n();
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const g = settings.general;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('general', initialSetup ? {language: g.language, timezone: g.timezone} : settings.general as unknown as Record<string, unknown>);
      toast.success(t('general.saved'));
    } catch {
      toast.error(t('general.saveFailed'));
    }
    setSaving(false);
  };

  return (
    <>
      <SettingSection title={t('general.title')} description={t('general.description')}>
        <SettingSelect
          label={t('general.language')}
          value={g.language}
          options={languageOptions(t('general.languageUnavailable'))}
          onChange={(v) => setLocalValue('general.language', v)}
        />
        <SettingSearchSelect
          label={t('general.timezone')}
          value={g.timezone}
          options={getTimezoneOptions()}
          onChange={(v) => setLocalValue('general.timezone', v)}
        />
        {!initialSetup && <>
        <SettingSelect
          label={t('general.dateFormat')}
          value={g.date_format}
          options={DATE_FORMATS}
          onChange={(v) => setLocalValue('general.date_format', v)}
        />
        <SettingSelect
          label={t('general.timeFormat')}
          value={g.time_format}
          options={[{ value: '24h', label: t('general.hour24') }, { value: '12h', label: t('general.hour12') }]}
          onChange={(v) => setLocalValue('general.time_format', v)}
        />
        <SettingSelect
          label={t('general.weekStart')}
          description={t('general.weekStartHelp')}
          value={String(settings.calendar?.first_day_of_week ?? 1)}
          options={[{ value: '1', label: t('general.monday') }, { value: '0', label: t('general.sunday') }]}
          onChange={async (v) => {
            // Lives in calendar.first_day_of_week (existing field), but
            // we expose it here in General because it also drives
            // weekly filters across notes/diary/etc. Save inline so it
            // doesn't leave the unrelated Calendar section dirty.
            try {
              const next = { ...settings.calendar, first_day_of_week: parseInt(v, 10) as 0 | 1 };
              await updateSection('calendar', next as unknown as Record<string, unknown>);
              toast.success(t('general.weekSaved'));
            } catch {
              toast.error(t('general.weekSaveFailed'));
            }
          }}
        />

        <div style={{ padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          {t('general.today', { date: formatPreview(g.date_format, g.time_format) })}
        </div>
        </>}
      </SettingSection>

      <SaveBar visible={!!dirty.general} saving={saving} onSave={handleSave} onDiscard={() => resetSection('general')} />
    </>
  );
}
