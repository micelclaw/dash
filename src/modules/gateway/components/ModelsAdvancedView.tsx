/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { useGatewayStore } from '@/stores/gateway.store';
import { isModelRefValid } from '../lib/refs';
import { LocalOllamaBlock } from './LocalOllamaBlock';
import { ProviderStatusBlock } from './ProviderStatusBlock';

/**
 * Models → Advanced sub-tab. Power-user configuration:
 *   - Provider status (informational overview of credentials)
 *   - Local Ollama runtime + embedding reindex
 *   - Aliases (short names → fully-qualified models)
 *   - Fallbacks (text + image)
 */
export function ModelsAdvancedView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ProviderStatusBlock />
      <LocalOllamaBlock />
      <AliasesBlock />
      <FallbacksBlock kind="text" />
      <FallbacksBlock kind="image" />
    </div>
  );
}

// ─── Aliases ────────────────────────────────────────────────────────

function AliasesBlock() {
  const models = useGatewayStore(s => s.models);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newModel, setNewModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getAliases();
      setAliases(data);
    } catch { toast.error('Failed to load aliases'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdd = async () => {
    if (!newAlias.trim() || !newModel.trim()) return;
    setSaving(true);
    try {
      await gwService.addAlias(newAlias.trim(), newModel.trim());
      toast.success(`Alias "${newAlias}" added`);
      setNewAlias('');
      setNewModel('');
      setShowAdd(false);
      fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add alias');
    } finally { setSaving(false); }
  };

  const handleRemove = async (alias: string) => {
    setRemoving(alias);
    try {
      await gwService.removeAlias(alias);
      toast.success(`Alias "${alias}" removed`);
      fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove alias');
    } finally { setRemoving(null); }
  };

  return (
    <Section title="Aliases" description="Short names for your models. Use them in chat or in the CLI.">
      {loading ? <SectionLoading /> : (
        <>
          {Object.keys(aliases).length === 0 && !showAdd && (
            <EmptyHint>No aliases yet. Add one to use shorter names like <code>sonnet</code> instead of <code>anthropic/claude-sonnet-4-6</code>.</EmptyHint>
          )}
          {Object.entries(aliases).map(([alias, model]) => {
            const valid = isModelRefValid(model, models);
            return (
              <Row key={alias}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                  <strong style={{ color: 'var(--amber)' }}>{alias}</strong>
                  <span style={{ color: 'var(--text-dim)', margin: '0 8px' }}>→</span>
                  <span style={{ color: valid ? 'var(--text)' : '#f43f5e' }}>{model}</span>
                  {!valid && <DanglingBadge title="Target not in configured models" />}
                </span>
                <RemoveButton onClick={() => handleRemove(alias)} loading={removing === alias} />
              </Row>
            );
          })}
          {showAdd ? (
            <div style={{
              display: 'flex',
              gap: 8,
              padding: 10,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              <input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="Alias (e.g. sonnet)"
                style={inlineInput}
                autoFocus
              />
              <input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="anthropic/claude-sonnet-4-6"
                style={{ ...inlineInput, flex: 2 }}
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newAlias.trim() || !newModel.trim()}
                style={primaryBtn}
              >
                {saving ? <Loader2 size={12} className="spin" /> : 'Add'}
              </button>
              <button onClick={() => setShowAdd(false)} style={secondaryBtn}>Cancel</button>
            </div>
          ) : (
            <AddButton label="Add alias" onClick={() => setShowAdd(true)} />
          )}
        </>
      )}
    </Section>
  );
}

// ─── Fallbacks (text or image) ──────────────────────────────────────

function FallbacksBlock({ kind }: { kind: 'text' | 'image' }) {
  const models = useGatewayStore(s => s.models);
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newModel, setNewModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const [reordering, setReordering] = useState(false);
  const list = kind === 'text' ? gwService.getFallbacks : gwService.getImageFallbacks;
  const add = kind === 'text' ? gwService.addFallback : gwService.addImageFallback;
  const remove = kind === 'text' ? gwService.removeFallback : gwService.removeImageFallback;
  const setOrder = kind === 'text' ? gwService.setFallbacks : gwService.setImageFallbacks;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setFallbacks(await list());
    } catch { toast.error('Failed to load fallbacks'); }
    finally { setLoading(false); }
  }, [list]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdd = async () => {
    if (!newModel.trim()) return;
    setSaving(true);
    try {
      await add(newModel.trim());
      toast.success('Fallback added');
      setNewModel('');
      setShowAdd(false);
      fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add fallback');
    } finally { setSaving(false); }
  };

  const handleRemove = async (model: string) => {
    setRemoving(model);
    try {
      await remove(model);
      toast.success('Fallback removed');
      fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove fallback');
    } finally { setRemoving(null); }
  };

  // Mover una entrada arriba/abajo → fija el orden completo (el orden ES la
  // prioridad de fallback). Optimista con rollback si el backend falla.
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= fallbacks.length || reordering) return;
    const prev = fallbacks;
    const next = [...fallbacks];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setFallbacks(next);
    setReordering(true);
    try {
      await setOrder(next);
    } catch (err) {
      setFallbacks(prev);
      toast.error(err instanceof Error ? err.message : 'Failed to reorder fallbacks');
    } finally { setReordering(false); }
  };

  const title = kind === 'text' ? 'Fallbacks' : 'Image model fallbacks';
  const description = kind === 'text'
    ? 'If the primary model fails, try these in order.'
    : 'Image generation models to try if the default fails.';

  return (
    <Section title={title} description={description}>
      {loading ? <SectionLoading /> : (
        <>
          {fallbacks.length === 0 && !showAdd && (
            <EmptyHint>No {kind === 'text' ? 'text' : 'image'} fallbacks configured.</EmptyHint>
          )}
          {fallbacks.map((model, i) => {
            const valid = isModelRefValid(model, models);
            return (
              <Row key={model}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--text-dim)', marginRight: 8 }}>{i + 1}.</span>
                  <span style={{ color: valid ? 'var(--text)' : '#f43f5e' }}>{model}</span>
                  {!valid && <DanglingBadge title="Fallback not in configured models" />}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ReorderButton dir="up" disabled={i === 0 || reordering} onClick={() => move(i, -1)} />
                  <ReorderButton dir="down" disabled={i === fallbacks.length - 1 || reordering} onClick={() => move(i, 1)} />
                  <RemoveButton onClick={() => handleRemove(model)} loading={removing === model} />
                </span>
              </Row>
            );
          })}
          {showAdd ? (
            <div style={{
              display: 'flex',
              gap: 8,
              padding: 10,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              <input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="provider/model"
                style={inlineInput}
                autoFocus
              />
              <button onClick={handleAdd} disabled={saving || !newModel.trim()} style={primaryBtn}>
                {saving ? <Loader2 size={12} className="spin" /> : 'Add'}
              </button>
              <button onClick={() => setShowAdd(false)} style={secondaryBtn}>Cancel</button>
            </div>
          ) : (
            <AddButton label={`Add ${kind} fallback`} onClick={() => setShowAdd(true)} />
          )}
        </>
      )}
    </Section>
  );
}

// (AuthProfilesBlock removed — functionality moved to ProviderStatusBlock)

// ─── Shared bits ────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 style={{
        margin: '0 0 4px',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: 'var(--text)',
        fontFamily: 'var(--font-display)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>{title}</h3>
      <p style={{
        margin: '0 0 12px',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        lineHeight: 1.4,
      }}>{description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '8px 12px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      {children}
    </div>
  );
}

function DanglingBadge({ title }: { title: string }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
        padding: '1px 6px',
        background: '#f43f5e20',
        color: '#f43f5e',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.625rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <AlertTriangle size={10} /> invalid
    </span>
  );
}

function RemoveButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        color: 'var(--text-dim)',
        padding: 4,
        display: 'flex',
      }}
    >
      {loading ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
    </button>
  );
}

function ReorderButton({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled: boolean; onClick: () => void }) {
  const Icon = dir === 'up' ? ChevronUp : ChevronDown;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={dir === 'up' ? 'Move up (higher priority)' : 'Move down'}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--border)' : 'var(--text-dim)',
        padding: 2,
        display: 'flex',
      }}
    >
      <Icon size={14} />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: 'transparent',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-dim)',
        fontSize: '0.75rem',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Plus size={12} /> {label}
    </button>
  );
}

function SectionLoading() {
  return (
    <div style={{
      padding: 12,
      color: 'var(--text-dim)',
      fontSize: '0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <Loader2 size={12} className="spin" /> Loading...
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '0.75rem',
      color: 'var(--text-dim)',
      lineHeight: 1.5,
      padding: '4px 0',
      fontStyle: 'italic',
    }}>{children}</p>
  );
}

const inlineInput: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  color: 'var(--text)',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  background: 'var(--amber)',
  color: '#000',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 14px',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-dim)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 14px',
  fontSize: '0.75rem',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
