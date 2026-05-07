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

import { useState, useEffect } from 'react';
import { SettingsBlock } from '../shared/SettingsBlock';
import { CronConfigSection } from './CronConfigSection';
import { HooksSection } from './HooksSection';

const LS_KEY = 'settings.automation.expanded';

interface PersistedState {
  cron: boolean;
  hooks: boolean;
}

function readPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { cron: true, hooks: false };
    const parsed = JSON.parse(raw);
    return {
      cron: typeof parsed?.cron === 'boolean' ? parsed.cron : true,
      hooks: typeof parsed?.hooks === 'boolean' ? parsed.hooks : false,
    };
  } catch {
    return { cron: true, hooks: false };
  }
}

export function AutomationSection() {
  const initial = readPersisted();
  const [openCron, setOpenCron] = useState(initial.cron);
  const [openHooks, setOpenHooks] = useState(initial.hooks);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ cron: openCron, hooks: openHooks }));
    } catch {
      // Quota / private mode — silently ignore, the UI still works
    }
  }, [openCron, openHooks]);

  return (
    <div>
      <h2
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 4px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Automation
      </h2>
      <p
        style={{
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          margin: '0 0 16px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Tasks that run on a schedule (Cron) or react to events (Hooks &amp; Webhooks).
      </p>

      <SettingsBlock
        title="Cron jobs"
        description="Scheduled tasks"
        expanded={openCron}
        onToggle={() => setOpenCron((v) => !v)}
      >
        <div style={{ marginTop: 4 }}>
          <CronConfigSection />
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Hooks & Webhooks"
        description="Event-driven actions"
        expanded={openHooks}
        onToggle={() => setOpenHooks((v) => !v)}
      >
        <div style={{ marginTop: 4 }}>
          <HooksSection />
        </div>
      </SettingsBlock>
    </div>
  );
}
