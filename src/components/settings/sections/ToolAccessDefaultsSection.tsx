/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import * as agentsAdmin from '@/services/agents-admin.service';
import { describeError } from '@/lib/api-errors';
import { SectionShell } from '../shared/SectionShell';
import { useToolCatalog } from '@/modules/agents/hooks/use-tool-catalog';
import { useAuthStore } from '@/stores/auth.store';

// Tool access response shape lives in agents-admin.service.ts now.

export function ToolAccessDefaultsSection() {
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = role === 'owner' || role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Catálogo dinámico (nativas + presets + workboard) — sustituye TOOL_DESCRIPTIONS/
  // ALL_TOOLS/CODING_PRESET/PRESET_TOOLS hardcodeados, compartido con AgentToolAccess.
  const catalog = useToolCatalog();

  const [profile, setProfile] = useState('coding');
  // alsoAllow: tools to add ON TOP of the preset (without replacing allow)
  // deny: tools to remove FROM the preset
  const [alsoAllow, setAlsoAllow] = useState<Set<string>>(new Set());
  const [deny, setDeny] = useState<Set<string>>(new Set());

  const [firstAgentId, setFirstAgentId] = useState<string | null>(null);

  const toolDescriptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of catalog.nativeGroups) for (const t of g.tools) m.set(t.name, t.desc);
    return m;
  }, [catalog.nativeGroups]);

  const basePresetTools = useCallback((p: string): Set<string> => {
    return new Set(catalog.nativePresets[p] ?? catalog.nativePresets.coding ?? []);
  }, [catalog.nativePresets]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const agents = await agentsAdmin.listManagedAgents();
      const first = agents[0];
      if (first?.id) {
        setFirstAgentId(first.id);
        const data = await agentsAdmin.getToolAccess(first.id);
        setProfile(data.global.profile ?? 'coding');
        setAlsoAllow(new Set(data.global.also_allow ?? data.global.allow ?? []));
        setDeny(new Set(data.global.deny ?? []));
      }
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to load tool access defaults'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const isToolEnabled = (tool: string): boolean => {
    if (deny.has(tool)) return false;
    if (alsoAllow.has(tool)) return true;
    return basePresetTools(profile).has(tool);
  };

  const handleToolToggle = (tool: string) => {
    if (!canEdit) return;
    const base = basePresetTools(profile);
    const currentlyEnabled = isToolEnabled(tool);
    const newAlsoAllow = new Set(alsoAllow);
    const newDeny = new Set(deny);

    if (currentlyEnabled) {
      // Disable the tool
      newAlsoAllow.delete(tool);
      if (base.has(tool)) {
        // Tool is in the base preset — need to deny it
        newDeny.add(tool);
      }
    } else {
      // Enable the tool
      newDeny.delete(tool);
      if (!base.has(tool)) {
        // Tool is NOT in the base preset — need to also-allow it
        newAlsoAllow.add(tool);
      }
    }

    setAlsoAllow(newAlsoAllow);
    setDeny(newDeny);
    setDirty(true);
  };

  const handleProfileSelect = (value: string) => {
    if (!canEdit) return;
    setProfile(value);
    // Reset overrides when changing profile
    setAlsoAllow(new Set());
    setDeny(new Set());
    setDirty(true);
  };

  const handleSave = async () => {
    if (!firstAgentId) return;
    setSaving(true);
    try {
      await agentsAdmin.updateToolAccess(firstAgentId, {
        scope: 'global',
        profile,
        allow: alsoAllow.size > 0 ? [...alsoAllow] : null,
        deny: deny.size > 0 ? [...deny] : null,
      });
      toast.success('Global tool access defaults updated');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update tool access defaults'));
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = catalog.allNativeTools.filter(t => isToolEnabled(t)).length;
  const hasOverrides = alsoAllow.size > 0 || deny.size > 0;

  const profiles = useMemo(() => (['minimal', 'coding', 'messaging', 'full'] as const).map((value) => {
    const nativeCount = catalog.nativePresets[value]?.length ?? 0;
    const wbCount = catalog.workboardEnabled ? (catalog.profileTools[value]?.tools.length ?? 0) : 0;
    const desc = wbCount > 0
      ? `${nativeCount} tools + ${wbCount} workboard tools`
      : `${nativeCount} tools`;
    return {
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
      desc: value === 'coding' ? `${desc} (recommended)` : desc,
    };
  }), [catalog.nativePresets, catalog.profileTools, catalog.workboardEnabled]);

  // Set de workboard que trae el perfil global ELEGIDO — informativo (el override
  // global por-tool no lo soporta el backend en v1; esto solo VISUALIZA qué trae
  // cada perfil, sin toggle que persista).
  const workboardForProfile = useMemo(() => new Set(catalog.profileTools[profile]?.tools ?? []), [catalog.profileTools, profile]);

  // Loading state is rendered by SectionShell. The "no agents" state
  // is a separate empty-state — bypass the shell entirely.
  if (!loading && !firstAgentId) {
    return (
      <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No agents available yet. Create an agent first under <strong>Agents</strong>.
      </div>
    );
  }

  return (
    <SectionShell
      title="Default tool profile"
      loading={loading || catalog.loading}
      dirty={dirty}
      saving={saving}
      onSave={canEdit ? handleSave : undefined}
    >
      <p style={{ margin: '-12px 0 20px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        Global default applied to every agent set to <strong>Inherit</strong> mode.
        Agents with their own preset (Minimal/Coding/Messaging/Full) ignore this.{' '}
        <Link
          to="/agents"
          style={{ color: 'var(--amber)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Per-agent overrides <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'baseline' }} />
        </Link>
        {hasOverrides && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>· custom overrides active</span>}
        {!canEdit && <span style={{ marginLeft: 6 }}>· read only</span>}
      </p>

      {/* Profile selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {profiles.map(p => (
          <label
            key={p.value}
            onClick={() => handleProfileSelect(p.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: profile === p.value ? 'var(--surface-hover)' : 'var(--surface)',
              border: profile === p.value ? '1px solid var(--amber-dim)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: canEdit ? 'pointer' : 'default',
              transition: 'var(--transition-fast)',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: profile === p.value ? '5px solid var(--amber)' : '2px solid var(--text-muted)',
              background: 'transparent', flexShrink: 0,
              transition: 'border 0.2s',
            }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{p.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>{p.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Interactive tool tags */}
      <div>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Tools enabled ({enabledCount}/{catalog.allNativeTools.length})
        </h3>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Click to toggle. Overrides are saved on top of the selected profile.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {catalog.allNativeTools.map(tool => {
            const enabled = isToolEnabled(tool);
            const base = basePresetTools(profile);
            const isOverrideAdded = alsoAllow.has(tool); // added on top of preset
            const isOverrideRemoved = deny.has(tool) && base.has(tool); // removed from preset
            return (
              <span
                key={tool}
                onClick={() => handleToolToggle(tool)}
                style={{
                  padding: '4px 10px', fontSize: '0.6875rem',
                  background: enabled ? '#22c55e18' : 'var(--surface)',
                  color: enabled ? '#22c55e' : 'var(--text-muted)',
                  border: `1px solid ${
                    isOverrideAdded ? 'var(--amber-dim)' :
                    isOverrideRemoved ? '#ef444440' :
                    enabled ? '#22c55e30' : 'var(--border)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono, var(--font-sans))',
                  cursor: canEdit ? 'pointer' : 'default',
                  transition: 'var(--transition-fast)',
                  textDecoration: isOverrideRemoved ? 'line-through' : 'none',
                  userSelect: 'none',
                }}
                title={toolDescriptions.get(tool) ?? tool}
              >
                {tool}
              </span>
            );
          })}
        </div>
        {hasOverrides && (
          <button
            onClick={() => { if (!canEdit) return; setAlsoAllow(new Set()); setDeny(new Set()); setDirty(true); }}
            disabled={!canEdit}
            style={{
              marginTop: 8, padding: '3px 8px', fontSize: '0.6875rem',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Clear overrides
          </button>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Micelclaw System
        </h3>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Tools de sistema incluidas por perfil o contexto. Las obligatorias de diagnóstico, skills y heartbeat no pueden desactivarse.
        </p>
        {catalog.systemGroups.map((group) => (
          <div key={group.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {group.tools.map((tool) => {
                const state = catalog.effectiveTools.find((item) => item.name === tool.name);
                const enabled = state?.effective ?? false;
                return (
                  <span key={tool.name} title={tool.description} style={{ padding: '4px 8px', fontSize: '0.625rem', borderRadius: 'var(--radius-sm)', background: enabled ? '#22c55e18' : 'var(--surface)', color: enabled ? 'var(--success)' : 'var(--text-muted)', border: `1px solid ${enabled ? '#22c55e30' : 'var(--border)'}`, fontFamily: 'var(--font-mono)' }}>
                    {tool.name}{tool.required ? ' 🔒' : ''}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '10px 0 0' }}>
          Apps y conexiones MCP personales se configuran por agente.{' '}
          <Link to="/agents" style={{ color: 'var(--amber)', textDecoration: 'none' }}>Open Agents</Link>{' · '}
          <Link to={catalog.mcpConnectionsLink} style={{ color: 'var(--amber)', textDecoration: 'none' }}>MCP Connections</Link>
        </p>
      </div>

      {/* Workboard (plugin de primera clase): informativo a nivel global — muestra qué
          set de tools trae el perfil global elegido (profile_tools[profile]). El backend
          no soporta override global por-tool en v1 (solo per-agent), así que aquí NO hay
          toggle que persista; se ve por-agente en Agents → Tools. Va ENTRE "Tools enabled"
          y "Micelclaw OS · bundle-mcp" (petición del usuario). */}
      {catalog.workboardEnabled && catalog.workboardGroups.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Workboard ({workboardForProfile.size}/{catalog.allWorkboardTools.length} in {profile})
          </h3>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
            Coordinación de tareas entre agentes. Set que trae el perfil <strong>{profile}</strong> elegido arriba —
            informativo (el override global por-tool se hace por agente en <strong>Agents → Tools</strong>).
          </p>
          {catalog.workboardGroups.map((group) => (
            <div key={group.key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {group.tools.map((t) => {
                  const inProfile = workboardForProfile.has(t.name);
                  return (
                    <span
                      key={t.name}
                      title={t.desc}
                      style={{
                        padding: '3px 8px', fontSize: '0.625rem',
                        background: inProfile ? '#22c55e18' : 'var(--surface)',
                        color: inProfile ? '#22c55e' : 'var(--text-muted)',
                        border: `1px solid ${inProfile ? '#22c55e30' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono, var(--font-sans))',
                        cursor: 'default', userSelect: 'none',
                      }}
                    >
                      {t.name}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

    </SectionShell>
  );
}
