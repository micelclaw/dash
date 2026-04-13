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
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { applyTheme, applyAccentColor } from '@/hooks/use-theme';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';
import { SaveBar } from '../SaveBar';
import { SettingsBlock } from '../shared/SettingsBlock';
import * as gwService from '@/services/gateway.service';
import type { UiConfig } from '@/services/gateway.service';

const MODULES_LIST = [
  { value: 'chat', label: 'AI Chat' },
  { value: 'notes', label: 'Notes' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'mail', label: 'Mail' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'drive', label: 'Drive' },
  { value: 'photos', label: 'Photos' },
  { value: 'diary', label: 'Diary' },
  { value: 'explorer', label: 'Explorer' },
  { value: 'agents', label: 'Agents' },
  { value: 'bookmarks', label: 'Bookmarks' },
];

const ACCENT_PRESETS = [
  { color: '#d4a017', label: 'Amber' },
  { color: '#22c55e', label: 'Green' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#a855f7', label: 'Purple' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f97316', label: 'Orange' },
  { color: '#14b8a6', label: 'Teal' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#06b6d4', label: 'Cyan' },
];

export function DashSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const d = settings.dash;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('dash', settings.dash as unknown as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <>
      <SettingSection title="Dashboard" description="Appearance and layout preferences.">
        {/* Theme pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Theme</div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {([
              { id: 'dark', label: 'Dark', dot: '#0c0c12' },
              { id: 'light', label: 'Light', dot: '#e0ded8' },
              { id: 'midnight', label: 'Midnight', dot: '#101828' },
              { id: 'ember', label: 'Ember', dot: '#1a1410' },
              { id: 'moss', label: 'Moss', dot: '#0e1410' },
              { id: 'lucid', label: 'Lucid', dot: '#12101a' },
            ] as const).map(({ id, label, dot }) => {
              const isActive = d.theme === id;
              return (
                <button
                  key={id}
                  onClick={() => setLocalValue('dash.theme', id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 30,
                    padding: '0 10px',
                    background: isActive ? 'var(--amber)' : 'var(--surface)',
                    color: isActive ? '#06060a' : 'var(--text-dim)',
                    border: isActive ? 'none' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, border: '1px solid rgba(128,128,128,0.3)', flexShrink: 0 }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Accent Color</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.color}
                title={p.label}
                onClick={() => setLocalValue('dash.accent_color', p.color)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: p.color,
                  border: d.accent_color === p.color ? '2px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={d.accent_color}
              onChange={(e) => setLocalValue('dash.accent_color', e.target.value)}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
              title="Custom color"
            />
          </div>
        </div>

        <SettingToggle
          label="Start with sidebar collapsed"
          checked={d.sidebar_collapsed}
          onChange={(v) => setLocalValue('dash.sidebar_collapsed', v)}
        />

        <SettingSelect
          label="Default Module"
          description="Module to show when you open Claw Dash"
          value={d.default_module}
          options={MODULES_LIST}
          onChange={(v) => setLocalValue('dash.default_module', v)}
        />
      </SettingSection>

      <SaveBar visible={!!dirty.dash} saving={saving} onSave={handleSave} onDiscard={() => {
        const original = useSettingsStore.getState().original;
        resetSection('dash');
        if (original?.dash) {
          applyTheme(original.dash.theme);
          applyAccentColor(original.dash.accent_color);
        }
      }} />

      {/* Ola 7 (oc7-3) — OpenClaw branding (advanced) */}
      <OpenclawBrandingBlock />
    </>
  );
}

// ─── OpenClaw Branding (Ola 7, oc7-3) ───────────────────────────────
//
// Collapsible block that exposes `ui.seamColor`, `ui.assistant.name`,
// `ui.assistant.avatar` from openclaw.json. These fields are visible
// to clients connecting to OpenClaw natively (ACP, OpenClaw's own UI),
// NOT to dash users — so the block is collapsed by default and clearly
// labelled as advanced. Saves are independent from the dash theming
// above (different endpoint, different store).

function OpenclawBrandingBlock() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [seamColor, setSeamColor] = useState('#d4a017');
  const [assistantName, setAssistantName] = useState('');
  const [assistantAvatar, setAssistantAvatar] = useState('');
  const [avatarBroken, setAvatarBroken] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getUiConfig();
      setSeamColor(data.seam_color ?? '#d4a017');
      setAssistantName(data.assistant?.name ?? '');
      setAssistantAvatar(data.assistant?.avatar ?? '');
      setDirty(false);
    } catch {
      // Silent — section may be hidden
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !loading && !dirty) fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [assistantAvatar]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: UiConfig = {
        seam_color: seamColor,
        assistant: {
          name: assistantName || undefined,
          avatar: assistantAvatar || undefined,
        },
      };
      await gwService.updateUiConfig(config);
      toast.success('OpenClaw branding updated');
      setDirty(false);
    } catch {
      toast.error('Failed to update OpenClaw branding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsBlock
      title="OpenClaw Branding (advanced)"
      description="Visible to ACP / native OpenClaw clients"
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      saveLabel="Save branding"
    >
      <p
        style={{
          margin: '12px 0',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        These fields are part of OpenClaw&apos;s native config (<code>ui.*</code>). They are NOT used by the dash
        (which has its own theming above). They appear when someone connects directly to OpenClaw via ACP
        (Claude Code, Codex, Zed) or visits OpenClaw&apos;s own UI on its gateway port.
      </p>

      {/* seamColor */}
      <FieldRow label="Seam color" desc="Hex color (RRGGBB) for OpenClaw's native UI accent.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={seamColor}
            onChange={(e) => {
              setSeamColor(e.target.value);
              setDirty(true);
            }}
            style={{
              width: 32,
              height: 24,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
            }}
          />
          <input
            type="text"
            value={seamColor}
            onChange={(e) => {
              setSeamColor(e.target.value);
              setDirty(true);
            }}
            placeholder="#d4a017"
            maxLength={7}
            style={{
              ...inputStyle(),
              width: 100,
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
      </FieldRow>

      {/* assistant.name */}
      <FieldRow
        label="Assistant name"
        desc="Display name shown to native ACP clients. Max 50 characters."
      >
        <input
          type="text"
          value={assistantName}
          onChange={(e) => {
            setAssistantName(e.target.value);
            setDirty(true);
          }}
          placeholder="Claw"
          maxLength={50}
          style={{ ...inputStyle(), width: 220 }}
        />
      </FieldRow>

      {/* assistant.avatar */}
      <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Assistant avatar</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              URL or absolute path to an image. Max 200 characters.
            </div>
          </div>
          <input
            type="text"
            value={assistantAvatar}
            onChange={(e) => {
              setAssistantAvatar(e.target.value);
              setDirty(true);
            }}
            placeholder="https://example.com/avatar.png"
            maxLength={200}
            style={{ ...inputStyle(), width: 280 }}
          />
        </div>
        {/* Preview */}
        {assistantAvatar && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {avatarBroken ? (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  border: '1px dashed var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.625rem',
                  color: 'var(--text-muted)',
                }}
              >
                ?
              </div>
            ) : (
              <img
                src={assistantAvatar}
                alt="Avatar preview"
                onError={() => setAvatarBroken(true)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--border)',
                }}
              />
            )}
            <span
              style={{
                fontSize: '0.6875rem',
                color: avatarBroken ? '#ef4444' : 'var(--text-muted)',
              }}
            >
              {avatarBroken ? 'Image not found' : 'Preview'}
            </span>
          </div>
        )}
      </div>
    </SettingsBlock>
  );
}

function FieldRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}

function inputStyle() {
  return {
    padding: '6px 10px',
    fontSize: '0.75rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };
}
