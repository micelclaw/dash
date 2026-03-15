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
import { FileText, X, ChevronRight } from 'lucide-react';
import type { DnsTemplate } from '../hooks/use-dns-zones';

interface ApplyTemplateModalProps {
  templates: DnsTemplate[];
  onApply: (templateId: string, variables: Record<string, string>) => Promise<boolean>;
  onClose: () => void;
}

export function ApplyTemplateModal({ templates, onApply, onClose }: ApplyTemplateModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  const selected = templates.find(t => t.id === selectedId) ?? null;

  const allFilled = selected
    ? selected.required_variables.every(v => variables[v]?.trim())
    : false;

  const handleApply = async () => {
    if (!selected || !allFilled) return;
    setApplying(true);
    const ok = await onApply(selected.id, variables);
    setApplying(false);
    if (ok) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          width: '100%', maxWidth: 520,
          maxHeight: '80vh', overflow: 'auto',
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{
            fontSize: '1rem', fontWeight: 600, color: 'var(--text)',
            margin: 0, fontFamily: 'var(--font-sans)',
          }}>
            Apply Template
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            <X size={18} />
          </button>
        </div>

        {!selected ? (
          /* Template list */
          templates.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              No templates available.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedId(t.id);
                    setVariables({});
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', textAlign: 'left',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface)',
                    cursor: 'pointer', width: '100%',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f666'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <FileText size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {t.records.length} records
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )
        ) : (
          /* Variable form */
          <>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: 16,
                fontFamily: 'var(--font-sans)',
              }}
            >
              &larr; Back to templates
            </button>

            <div style={{
              padding: '12px 14px', marginBottom: 16,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'rgba(59, 130, 246, 0.04)',
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{selected.name}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{selected.description}</div>
            </div>

            {selected.required_variables.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {selected.required_variables.map(v => (
                  <div key={v}>
                    <div style={{
                      fontSize: '0.625rem', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: 'var(--text-muted)', marginBottom: 4,
                    }}>
                      {v.replace(/_/g, ' ')}
                    </div>
                    <input
                      type="text"
                      placeholder={v === 'server_ip' ? '203.0.113.42' : v === 'domain' ? 'example.com' : v}
                      value={variables[v] ?? ''}
                      onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Preview */}
            <div style={{
              fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8,
            }}>
              Records to create ({selected.records.length})
            </div>
            <div style={{
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              overflow: 'hidden', marginBottom: 20,
            }}>
              {selected.records.map((r, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '50px 1fr 1fr',
                  padding: '8px 12px', borderBottom: i < selected.records.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: '0.75rem', alignItems: 'center',
                  background: 'var(--card)',
                }}>
                  <span style={{
                    fontWeight: 700, fontSize: '0.625rem',
                    padding: '1px 4px', borderRadius: 2,
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6', width: 'fit-content',
                  }}>
                    {r.type}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                    {resolveTemplate(r.name_template, variables)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)' }}>
                    {resolveTemplate(r.content_template, variables)}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleApply}
              disabled={!allFilled || applying}
              style={{
                width: '100%', padding: '10px 20px',
                background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
                cursor: (!allFilled || applying) ? 'not-allowed' : 'pointer',
                opacity: (!allFilled || applying) ? 0.5 : 1,
              }}
            >
              {applying ? 'Applying...' : `Apply Template (${selected.records.length} records)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function resolveTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono, monospace)', outline: 'none',
};
