/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, Info, Terminal, MessageSquare, Shield } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

const PRESETS = [
  {
    id: 'safe',
    name: 'Safe (Default)',
    icon: Shield,
    desc: 'Native slash commands in Telegram/Discord. No shell access. Ideal for most users.',
    config: { native: 'auto', nativeSkills: 'auto', bash: false, config: false, debug: false, restart: true },
  },
  {
    id: 'developer',
    name: 'Developer',
    icon: Terminal,
    desc: 'Safe defaults + shell access via ! <command>. For power users who want terminal in chat.',
    config: { native: 'auto', nativeSkills: 'auto', bash: true, config: true, debug: true, restart: true },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    icon: MessageSquare,
    desc: 'Text-only commands, no native slash menus. For platforms with limited command support.',
    config: { native: false, nativeSkills: false, bash: false, config: false, debug: false, restart: false },
  },
];

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      <div onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
        background: value ? 'var(--success, #22c55e)' : 'var(--text-muted)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left 0.2s' }} />
      </div>
    </div>
  );
}

export function CommandsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [native, setNative] = useState<string | boolean>('auto');
  const [nativeSkills, setNativeSkills] = useState<string | boolean>('auto');
  const [bash, setBash] = useState(false);
  const [configCmd, setConfigCmd] = useState(false);
  const [debug, setDebug] = useState(false);
  const [restart, setRestart] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getCommandsConfig();
      setNative((data.native ?? 'auto') as string | boolean);
      setNativeSkills((data.native_skills ?? 'auto') as string | boolean);
      setBash((data.bash ?? false) as boolean);
      setConfigCmd((data.config ?? false) as boolean);
      setDebug((data.debug ?? false) as boolean);
      setRestart((data.restart ?? true) as boolean);
      setDirty(false);
    } catch { toast.error('Failed to load commands config'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    const c = preset.config;
    setNative(c.native);
    setNativeSkills(c.nativeSkills);
    setBash(c.bash);
    setConfigCmd(c.config);
    setDebug(c.debug);
    setRestart(c.restart);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateCommandsConfig({
        native, nativeSkills, bash,
        config: configCmd, debug, restart,
      });
      toast.success('Commands config updated');
      setDirty(false);
    } catch { toast.error('Failed to update commands config'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;

  const currentPreset = PRESETS.find(p =>
    p.config.native === native && p.config.bash === bash && p.config.debug === debug
  );

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>Commands</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Configure slash commands, shell access, and platform-native command menus.
          </p>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600,
          background: dirty ? 'var(--amber)' : 'var(--surface)', border: dirty ? 'none' : '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: dirty ? '#000' : 'var(--text-muted)', cursor: dirty ? 'pointer' : 'default',
          opacity: saving ? 0.7 : 1, fontFamily: 'var(--font-sans)',
        }}>
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Info box */}
      <div style={{
        display: 'flex', gap: 10, padding: '12px 14px', marginBottom: 20,
        background: '#06b6d410', border: '1px solid #06b6d425', borderRadius: 'var(--radius-md)',
      }}>
        <Info size={16} style={{ color: '#06b6d4', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)' }}>How commands work:</strong> When you type <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>/help</code> in Telegram or Discord, the bot responds.
          With <strong>native commands</strong> enabled, slash commands appear as a menu in the chat app (like Discord's slash command picker).
          With <strong>bash mode</strong>, you can run shell commands directly: <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>! docker ps</code>
        </div>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Quick Presets
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRESETS.map(p => {
            const Icon = p.icon;
            const isActive = currentPreset?.id === p.id;
            return (
              <div key={p.id} onClick={() => applyPreset(p)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: isActive ? 'var(--surface-hover)' : 'var(--surface)',
                border: isActive ? '1px solid var(--amber-dim)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                  background: isActive ? '#d4a01718' : 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={18} style={{ color: isActive ? 'var(--amber)' : 'var(--text-dim)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                    {p.name}
                    {isActive && <span style={{ fontSize: '0.625rem', color: 'var(--amber)', marginLeft: 8, fontWeight: 600 }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2 }}>{p.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual toggles */}
      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Fine-Tune
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Native slash commands</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Show /commands as platform-native menus in Telegram and Discord
          </div>
        </div>
        <select value={String(native)} onChange={e => { setNative(e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value); setDirty(true); }} style={{
          padding: '4px 8px', fontSize: '0.75rem', minWidth: 120,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
        }}>
          <option value="auto">Auto (Telegram + Discord)</option>
          <option value="true">Always on</option>
          <option value="false">Off (text-only)</option>
        </select>
      </div>

      <Toggle label="Native skill commands" desc="Register skills as platform-native slash commands (e.g. /github, /weather)" value={nativeSkills === true || nativeSkills === 'auto'} onChange={v => { setNativeSkills(v ? 'auto' : false); setDirty(true); }} />
      <Toggle label="Shell access (! command)" desc="Enable ! <command> syntax to run shell commands from chat. Example: ! docker ps" value={bash} onChange={v => { setBash(v); setDirty(true); }} />
      <Toggle label="/config command" desc="Allow editing openclaw.json from chat via /config set/get/unset. Owner-only." value={configCmd} onChange={v => { setConfigCmd(v); setDirty(true); }} />
      <Toggle label="/debug command" desc="Allow runtime overrides from chat via /debug set/unset. Memory-only, not persisted." value={debug} onChange={v => { setDebug(v); setDirty(true); }} />
      <Toggle label="/restart command" desc="Allow restarting the Gateway from chat. Useful for remote administration." value={restart} onChange={v => { setRestart(v); setDirty(true); }} />

      {bash && (
        <div style={{
          display: 'flex', gap: 10, padding: '10px 14px', marginTop: 12,
          background: '#ef444410', border: '1px solid #ef444425', borderRadius: 'var(--radius-md)',
        }}>
          <Terminal size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <strong style={{ color: '#ef4444' }}>Shell access is powerful.</strong> Anyone in your allowlist can execute arbitrary commands on the host. Use with caution. Commands running &gt;2s are backgrounded automatically — use <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>!poll</code> to check status, <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>!stop</code> to kill.
          </div>
        </div>
      )}
    </div>
  );
}
