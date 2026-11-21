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

import { useEffect, useState, type CSSProperties } from 'react';
import { useI18n } from '@/i18n';
import { Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

const cardStyle: CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: 16,
};
const titleStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)',
};

/**
 * Toggle del setting users.settings.inventory.post_to_finance (C-N2). Gobierna
 * que la depreciación, la baja/venta y la capitalización de compras posteen
 * asientos en el mayor real de Finanzas. Un único interruptor para los 3 flujos.
 */
export function AccountingSettingsCard() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<{ data: { inventory?: { post_to_finance?: boolean } } }>('/settings')
      .then((res) => { if (alive) { setEnabled(Boolean(res.data?.inventory?.post_to_finance)); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await api.patch('/settings', { inventory: { post_to_finance: next } });
      toast.success(t(next ? 'inventory.accounting.enabled' : 'inventory.accounting.disabled'));
    } catch {
      setEnabled(!next);
      toast.error(t('inventory.accounting.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={titleStyle}><Landmark size={12} /> {t('inventory.accounting.title')}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)', marginTop: 6 }}>
            {t('inventory.accounting.posting')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2, maxWidth: 560 }}>
            {t('inventory.accounting.description')}
          </div>
        </div>
        {/* Switch */}
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={t(enabled ? 'inventory.accounting.disable' : 'inventory.accounting.enable')}
          disabled={saving}
          onClick={() => void toggle()}
          title={t(enabled ? 'inventory.accounting.disable' : 'inventory.accounting.enable')}
          style={{
            position: 'relative', width: 42, height: 24, flexShrink: 0, cursor: saving ? 'default' : 'pointer',
            borderRadius: 12, border: 'none', padding: 0,
            background: enabled ? 'var(--mod-inventory, var(--amber))' : 'var(--surface)',
            transition: 'background 0.15s',
          }}
        >
          <span
            style={{
              position: 'absolute', top: 3, left: enabled ? 21 : 3, width: 18, height: 18,
              borderRadius: '50%', background: enabled ? '#06060a' : 'var(--text-dim)',
              transition: 'left 0.15s',
            }}
          />
        </button>
      </div>
    </div>
  );
}
