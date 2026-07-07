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

import { useEffect, useMemo, useState } from 'react';
import { PieChart, TrendingUp, ShieldCheck, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { AccountingSettingsCard } from '@/modules/inventory/components/AccountingSettingsCard';
import { DepreciationReport } from '@/modules/inventory/components/DepreciationReport';
import { fmtMoney } from '@/modules/inventory/types';

type GroupBy = 'category' | 'location';

const cardStyle: React.CSSProperties = {
  background: 'var(--card)',
  // Longhand por lado: una de las tarjetas (línea ~139) hace `{...cardStyle,
  // borderLeft: 3px}`; con `border` shorthand React avisa al re-renderizar
  // ("...don't mix shorthand and longhand"). Mismo patrón que el fix de #1167.
  borderTop: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
  borderLeft: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.6875rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-dim)',
  marginBottom: 12,
};

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ReportsTab() {
  const { valuation, locations, fetchValuation, selectItem } = useInventoryStore();
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [atDate, setAtDate] = useState<string>('');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [dossierLocationId, setDossierLocationId] = useState<string>('');
  const [generatingDossier, setGeneratingDossier] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchValuation({ group_by: groupBy, at: atDate || undefined });
  }, [groupBy, atDate, fetchValuation]);

  const groupLabel = (key: string): string => {
    if (groupBy === 'location') {
      if (!key) return 'No location';
      return locations.find(l => l.id === key)?.name ?? key;
    }
    return key || 'Uncategorized';
  };

  const maxGroupValue = useMemo(() => {
    if (!valuation || valuation.groups.length === 0) return 1;
    return Math.max(...valuation.groups.map(g => g.value), 1);
  }, [valuation]);

  const topItems = useMemo(() => {
    if (!valuation) return [];
    return [...valuation.lines].sort((a, b) => b.value - a.value).slice(0, 10);
  }, [valuation]);

  const handleExportCsv = () => {
    if (!valuation || valuation.lines.length === 0) {
      toast.error('No valuation data to export');
      return;
    }
    const header = 'name,category,qty,unit_value,value';
    const rows = valuation.lines.map(l =>
      [l.name, l.category, l.qty, l.unit_value, l.value].map(csvCell).join(','),
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-valuation.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Valuation exported as CSV');
  };

  const handleGenerateDossier = async () => {
    setGeneratingDossier(true);
    try {
      const res = await api.post<{ data: { file_id: string; filename: string } }>(
        '/inventory/reports/dossier',
        { location_id: dossierLocationId || undefined },
        { timeout: 120_000 },
      );
      toast.success('Dossier saved to /Inventory/reports/');
      window.open('/api/v1/files/' + res.data.file_id + '/download');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate dossier');
    } finally {
      setGeneratingDossier(false);
    }
  };

  const segmentBtn = (value: GroupBy, label: string) => (
    <button
      onClick={() => setGroupBy(value)}
      style={{
        padding: '4px 10px',
        fontSize: '0.75rem',
        fontWeight: groupBy === value ? 600 : 400,
        background: groupBy === value ? 'var(--surface-hover)' : 'transparent',
        color: groupBy === value ? 'var(--text)' : 'var(--text-dim)',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 1100, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 0. Accounting toggle (C-N2: post depreciación/baja/capitalización a Finance) */}
      <AccountingSettingsCard />

      {/* 1. Valuation card */}
      <div style={{ ...cardStyle, borderLeft: '3px solid var(--mod-inventory)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={sectionTitleStyle}>
              <PieChart size={13} />
              Inventory value
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>
              {valuation ? fmtMoney(valuation.total) : '—'}
            </div>
            {valuation && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                as of {new Date(valuation.at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Valuation at…
              <input
                type="date"
                value={atDate}
                onChange={e => setAtDate(e.target.value)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                }}
              />
            </label>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {segmentBtn('category', 'By category')}
              {segmentBtn('location', 'By location')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {!valuation && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading valuation…</div>
          )}
          {valuation && valuation.groups.length === 0 && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No valued items yet.</div>
          )}
          {valuation?.groups.map(g => (
            <div
              key={g.key || '__none__'}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) 1fr auto auto', alignItems: 'center', gap: 12 }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {groupLabel(g.key)}
              </span>
              <div style={{ background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: 6,
                    width: `${Math.max((g.value / maxGroupValue) * 100, 1)}%`,
                    background: 'var(--mod-inventory)',
                    borderRadius: 3,
                  }}
                />
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', textAlign: 'right', minWidth: 80 }}>
                {fmtMoney(g.value)}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'right', minWidth: 56 }}>
                {g.item_count} items
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 1b. Depreciation (book value vs accumulated) — C-N1 con recharts */}
      <DepreciationReport />

      {/* 2. Report cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
        {/* a. Top items by value */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <TrendingUp size={13} />
            Top items by value
          </div>
          {topItems.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>No valued items yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topItems.map(line => (
                <div
                  key={line.item_id}
                  onClick={() => selectItem(line.item_id)}
                  onMouseEnter={() => setHoveredItemId(line.item_id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: hoveredItemId === line.item_id ? 'var(--surface-hover)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {line.name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                    {line.qty > 1 && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                        {line.qty} × {fmtMoney(line.unit_value)}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                      {fmtMoney(line.value)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* b. Insurance dossier */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <ShieldCheck size={13} />
            Insurance dossier
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Expert-ready PDF per location with photos, serials, receipts and values.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={dossierLocationId}
              onChange={e => setDossierLocationId(e.target.value)}
              disabled={generatingDossier}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                padding: '5px 8px',
                fontSize: '0.75rem',
                maxWidth: 180,
              }}
            >
              <option value="">All locations</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button
              onClick={handleGenerateDossier}
              disabled={generatingDossier}
              style={{
                background: 'var(--amber)',
                color: '#06060a',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontSize: '0.8125rem',
                opacity: generatingDossier ? 0.6 : 1,
                cursor: generatingDossier ? 'wait' : 'pointer',
              }}
            >
              {generatingDossier ? 'Generating…' : 'Generate PDF'}
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 12 }}>
            Reports are saved to /Inventory/reports/
          </div>
        </div>

        {/* c. Export */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <Download size={13} />
            Export
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Download the current valuation lines as a spreadsheet-friendly CSV file.
          </p>
          <button
            onClick={handleExportCsv}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
