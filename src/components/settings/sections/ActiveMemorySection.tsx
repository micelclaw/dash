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

// ─── Active Memory Section ───────────────────────────────────────────
//
// Controls `plugins.entries['active-memory'].config` in openclaw.json.
// The active-memory plugin runs a recall sub-agent BEFORE each agent reply
// to proactively inject relevant memory context — without the user having to
// ask "do you remember...".
//
// The plugin is bundled in OpenClaw 2026.5.7 but must be explicitly enabled.
// This section shows a banner + one-click "Activar plugin" button when disabled,
// identical to the TelemetrySection pattern for diagnostics-otel.

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';
import { SettingsBlock } from '../shared/SettingsBlock';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';

// ─── Agent list (short names — apply to all users) ──────────────────

const AGENT_OPTIONS: { id: string; label: string; desc: string }[] = [
  { id: 'francis',  label: 'Francis',  desc: 'Agente principal' },
  { id: 'atlas',    label: 'Atlas',    desc: 'Metodología y planificación' },
  { id: 'dali',     label: 'Dali',     desc: 'Creatividad y diseño' },
  { id: 'sentinel', label: 'Sentinel', desc: 'Seguridad y vigilancia' },
  { id: 'ledger',   label: 'Ledger',   desc: 'Finanzas y números' },
  { id: 'darwin',   label: 'Darwin',   desc: 'Ciencia y datos' },
  { id: 'hass',     label: 'Hass',     desc: 'Home Assistant' },
];

const CHAT_TYPES = ['direct', 'group', 'channel', 'explicit'] as const;
type ChatType = typeof CHAT_TYPES[number];

const QUERY_MODE_OPTIONS = [
  { value: 'message', label: 'Mensaje — solo el último mensaje (rápido, ~3-5s)' },
  { value: 'recent',  label: 'Reciente — últimos turnos (balance, ~15s)' },
  { value: 'full',    label: 'Completo — conversación entera (lento, máxima calidad)' },
];

const PROMPT_STYLE_OPTIONS = [
  { value: 'balanced',        label: 'Equilibrado (por defecto)' },
  { value: 'strict',          label: 'Estricto — solo si es obvio' },
  { value: 'contextual',      label: 'Contextual — favorece continuidad' },
  { value: 'recall-heavy',    label: 'Recall agresivo — más permisivo' },
  { value: 'precision-heavy', label: 'Precisión — solo coincidencias claras' },
  { value: 'preference-only', label: 'Solo preferencias — hábitos y rutinas' },
];

const THINKING_OPTIONS = [
  { value: 'off',      label: 'Desactivado (más rápido)' },
  { value: 'minimal',  label: 'Mínimo' },
  { value: 'low',      label: 'Bajo' },
  { value: 'medium',   label: 'Medio' },
  { value: 'high',     label: 'Alto' },
  { value: 'xhigh',   label: 'Máximo' },
  { value: 'adaptive', label: 'Adaptativo' },
];

// ─── Row helpers (inline, same style as MemorySearchSection) ─────────

const ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  paddingTop: 10,
  paddingBottom: 10,
  borderBottom: '1px solid var(--border-subtle)',
};

const LABEL_COL: React.CSSProperties = {
  flex: '0 0 180px',
  fontSize: '0.8125rem',
  lineHeight: 1.4,
};

const CTRL_COL: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const DESC: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  lineHeight: 1.4,
};

// ─── Main component ──────────────────────────────────────────────────

export function ActiveMemorySection() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [dirty, setDirty]       = useState(false);
  const [pluginEnabled, setPluginEnabled] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Estado general
  const [enabled, setEnabled]     = useState(false);
  const [agents, setAgents]       = useState<string[]>(['francis']);

  // Comportamiento de recall
  const [queryMode, setQueryMode]         = useState('recent');
  const [promptStyle, setPromptStyle]     = useState('balanced');
  const [maxSummaryChars, setMaxSummaryChars] = useState(220);
  const [timeoutMs, setTimeoutMs]         = useState(15000);

  // Filtros de chat
  const [allowedChatTypes, setAllowedChatTypes] = useState<ChatType[]>(['direct']);
  const [allowedChatIdsText, setAllowedChatIdsText] = useState('');
  const [deniedChatIdsText, setDeniedChatIdsText]   = useState('');

  // Modelo
  const [model, setModel]               = useState('');
  const [modelFallback, setModelFallback] = useState('');
  const [thinking, setThinking]         = useState('off');

  // Avanzado
  const [cacheTtlMs, setCacheTtlMs]                             = useState(15000);
  const [circuitBreakerMaxTimeouts, setCircuitBreakerMaxTimeouts] = useState(3);
  const [circuitBreakerCooldownMs, setCircuitBreakerCooldownMs]   = useState(60000);
  const [setupGraceTimeoutMs, setSetupGraceTimeoutMs]           = useState(0);
  const [loggingEnabled, setLoggingEnabled]                     = useState(false);
  const [persistTranscripts, setPersistTranscripts]             = useState(false);

  // Secciones colapsadas
  const [sections, setSections] = useState({
    recall: true,
    filters: false,
    model: false,
    advanced: false,
  });

  // ── Fetch ──────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [data, catalog] = await Promise.all([
        gwService.getActiveMemoryConfig(),
        gwService.getModelCatalog().catch(() => ({ models: [] })),
      ]);
      setAvailableModels(
        catalog.models
          .filter(m => m.available)
          .map(m => m.key)
          .sort(),
      );
      setPluginEnabled(data.plugin_enabled);
      const c = data.config ?? {};

      setEnabled((c.enabled as boolean) ?? false);
      setAgents((c.agents as string[]) ?? ['francis']);
      setQueryMode((c.query_mode as string) ?? 'recent');
      setPromptStyle((c.prompt_style as string) ?? 'balanced');
      setMaxSummaryChars((c.max_summary_chars as number) ?? 220);
      setTimeoutMs((c.timeout_ms as number) ?? 15000);
      setAllowedChatTypes(((c.allowed_chat_types as string[]) ?? ['direct']) as ChatType[]);
      setAllowedChatIdsText(((c.allowed_chat_ids as string[]) ?? []).join('\n'));
      setDeniedChatIdsText(((c.denied_chat_ids as string[]) ?? []).join('\n'));
      setModel((c.model as string) ?? '');
      setModelFallback((c.model_fallback as string) ?? '');
      setThinking((c.thinking as string) ?? 'off');
      setCacheTtlMs((c.cache_ttl_ms as number) ?? 15000);
      setCircuitBreakerMaxTimeouts((c.circuit_breaker_max_timeouts as number) ?? 3);
      setCircuitBreakerCooldownMs((c.circuit_breaker_cooldown_ms as number) ?? 60000);
      setSetupGraceTimeoutMs((c.setup_grace_timeout_ms as number) ?? 0);
      setLoggingEnabled((c.logging as boolean) ?? false);
      setPersistTranscripts((c.persist_transcripts as boolean) ?? false);
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Error al cargar configuración de Memoria Activa'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  // ── Enable plugin ──────────────────────────────────────────────────

  const handleEnablePlugin = async () => {
    setEnabling(true);
    try {
      await gwService.enableActiveMemoryPlugin();
      toast.success('Plugin active-memory activado');
      await fetchConfig();
    } catch (err) {
      toast.error(describeError(err, 'Error al activar el plugin'));
    } finally {
      setEnabling(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const parseIds = (text: string) =>
        text.split('\n').map(s => s.trim()).filter(Boolean);

      const config: Record<string, unknown> = {
        enabled,
        agents,
        query_mode:          queryMode,
        prompt_style:        promptStyle,
        max_summary_chars:   maxSummaryChars,
        timeout_ms:          timeoutMs,
        allowed_chat_types:  allowedChatTypes,
        allowed_chat_ids:    parseIds(allowedChatIdsText),
        denied_chat_ids:     parseIds(deniedChatIdsText),
        thinking,
        cache_ttl_ms:                    cacheTtlMs,
        circuit_breaker_max_timeouts:    circuitBreakerMaxTimeouts,
        circuit_breaker_cooldown_ms:     circuitBreakerCooldownMs,
        setup_grace_timeout_ms:          setupGraceTimeoutMs,
        logging:             loggingEnabled,
        persist_transcripts: persistTranscripts,
      };

      if (model.trim()) config.model = model.trim();
      if (modelFallback.trim()) config.model_fallback = modelFallback.trim();

      await gwService.updateActiveMemoryConfig(config);
      toast.success('Memoria Activa guardada');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Error al guardar configuración'));
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle helpers ─────────────────────────────────────────────────

  const toggleAgent = (id: string) => {
    setAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
    setDirty(true);
  };

  const toggleChatType = (type: ChatType) => {
    setAllowedChatTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    setDirty(true);
  };

  // ── Render ─────────────────────────────────────────────────────────

  const formDisabled = !pluginEnabled;

  return (
    <SectionShell
      title="Memoria Activa"
      description="Recall automático antes de cada respuesta: un sub-agente busca en tu memoria lo relevante y lo inyecta en el contexto sin que tengas que pedirlo."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
      saveDisabledReason={formDisabled ? 'Activa el plugin active-memory primero' : null}
    >

      {/* Banner plugin desactivado */}
      {!pluginEnabled && (
        <div style={{
          display: 'flex', gap: 12, padding: '14px 16px', marginBottom: 20,
          background: '#f59e0b15', border: '1px solid #f59e0b40',
          borderRadius: 'var(--radius-md)', alignItems: 'center',
        }}>
          <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)' }}>Plugin desactivado.</strong>{' '}
            El recall automático lo provee el plugin bundled{' '}
            <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>
              active-memory
            </code>. Actívalo para empezar a configurarlo.
          </div>
          <button
            onClick={handleEnablePlugin}
            disabled={enabling}
            style={{
              padding: '8px 14px', fontSize: '0.75rem', fontWeight: 600,
              background: '#f59e0b', border: 'none', borderRadius: 'var(--radius-sm)',
              color: '#000', cursor: enabling ? 'default' : 'pointer',
              fontFamily: 'var(--font-sans)', flexShrink: 0,
            }}
          >
            {enabling ? 'Activando...' : 'Activar plugin'}
          </button>
        </div>
      )}

      {/* Info cuando está activo */}
      {pluginEnabled && (
        <div style={{
          display: 'flex', gap: 10, padding: '12px 14px', marginBottom: 20,
          background: '#8b5cf610', border: '1px solid #8b5cf625',
          borderRadius: 'var(--radius-md)',
        }}>
          <Info size={16} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Con <strong style={{ color: 'var(--text)' }}>Active Memory</strong> activa, antes de cada respuesta del agente
            se lanza un sub-agente de recall que inyecta contexto relevante de tu memoria de forma invisible.
            Usa <code style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: 3 }}>/verbose on</code>{' '}
            en el chat para ver el trace del recall.
          </span>
        </div>
      )}

      {/* ── Estado general ────────────────────────────────────────── */}
      <SettingsBlock title="Estado general" expanded>

        {/* Toggle enabled */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Memoria Activa</div>
            <div style={DESC}>Activar recall automático en cada turno</div>
          </div>
          <div style={CTRL_COL}>
            <ToggleSwitch
              checked={enabled}
              onChange={markDirty(setEnabled)}
              disabled={formDisabled}
            />
          </div>
        </div>

        {/* Agentes */}
        <div style={{ ...ROW, borderBottom: 'none', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>Agentes con recall</div>
            <div style={DESC}>Selecciona qué agentes usan Memoria Activa</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AGENT_OPTIONS.map(a => (
              <label
                key={a.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${agents.includes(a.id) ? '#8b5cf6' : 'var(--border)'}`,
                  background: agents.includes(a.id) ? '#8b5cf610' : 'transparent',
                  cursor: formDisabled ? 'default' : 'pointer',
                  fontSize: '0.8125rem', userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={agents.includes(a.id)}
                  onChange={() => !formDisabled && toggleAgent(a.id)}
                  style={{ accentColor: '#8b5cf6' }}
                  disabled={formDisabled}
                />
                <span style={{ fontWeight: agents.includes(a.id) ? 500 : 400 }}>{a.label}</span>
              </label>
            ))}
          </div>
        </div>

      </SettingsBlock>

      {/* ── Comportamiento de recall ───────────────────────────── */}
      <SettingsBlock
        title="Comportamiento de recall"
        expanded={sections.recall}
        onToggle={() => setSections(p => ({ ...p, recall: !p.recall }))}
      >

        {/* queryMode */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Modo de consulta</div>
            <div style={DESC}>Cuánto contexto ve el sub-agente de recall</div>
          </div>
          <div style={CTRL_COL}>
            <select
              value={queryMode}
              onChange={e => { setQueryMode(e.target.value); setDirty(true); }}
              disabled={formDisabled}
              style={{ fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            >
              {QUERY_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* promptStyle */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Estilo de respuesta</div>
            <div style={DESC}>Cuán agresivo es el recall al surfacear memoria</div>
          </div>
          <div style={CTRL_COL}>
            <select
              value={promptStyle}
              onChange={e => { setPromptStyle(e.target.value); setDirty(true); }}
              disabled={formDisabled}
              style={{ fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            >
              {PROMPT_STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* maxSummaryChars */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Resumen máximo</div>
            <div style={DESC}>Caracteres máximos del contexto inyectado (40-1000)</div>
          </div>
          <div style={CTRL_COL}>
            <input
              type="number" min={40} max={1000}
              value={maxSummaryChars}
              onChange={e => markDirty(setMaxSummaryChars)(Number(e.target.value))}
              disabled={formDisabled}
              style={{ width: 80, fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            />
          </div>
        </div>

        {/* timeoutMs */}
        <div style={{ ...ROW, borderBottom: 'none' }}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Timeout (ms)</div>
            <div style={DESC}>Tiempo máximo para el recall antes de saltar (250-120000)</div>
          </div>
          <div style={CTRL_COL}>
            <input
              type="number" min={250} max={120000}
              value={timeoutMs}
              onChange={e => markDirty(setTimeoutMs)(Number(e.target.value))}
              disabled={formDisabled}
              style={{ width: 100, fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            />
          </div>
        </div>

      </SettingsBlock>

      {/* ── Filtros de chat ────────────────────────────────────── */}
      <SettingsBlock
        title="Filtros de chat"
        expanded={sections.filters}
        onToggle={() => setSections(p => ({ ...p, filters: !p.filters }))}
      >

        {/* allowedChatTypes */}
        <div style={{ ...ROW, flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>Tipos de chat permitidos</div>
            <div style={DESC}>Dónde se activa el recall (por defecto: solo DMs)</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CHAT_TYPES.map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', cursor: formDisabled ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowedChatTypes.includes(t)}
                  onChange={() => !formDisabled && toggleChatType(t)}
                  disabled={formDisabled}
                  style={{ accentColor: '#8b5cf6' }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>

        {/* allowedChatIds */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Chat IDs permitidos</div>
            <div style={DESC}>Solo activo en estos chats (uno por línea, vacío = todos)</div>
          </div>
          <div style={CTRL_COL}>
            <textarea
              value={allowedChatIdsText}
              onChange={e => { setAllowedChatIdsText(e.target.value); setDirty(true); }}
              disabled={formDisabled}
              rows={3}
              placeholder="ej: telegram:123456789"
              style={{ fontSize: '0.8125rem', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-mono)', resize: 'vertical', width: '100%' }}
            />
          </div>
        </div>

        {/* deniedChatIds */}
        <div style={{ ...ROW, borderBottom: 'none' }}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Chat IDs bloqueados</div>
            <div style={DESC}>Nunca activo en estos chats (uno por línea)</div>
          </div>
          <div style={CTRL_COL}>
            <textarea
              value={deniedChatIdsText}
              onChange={e => { setDeniedChatIdsText(e.target.value); setDirty(true); }}
              disabled={formDisabled}
              rows={3}
              placeholder="ej: slack:C1234ABCD"
              style={{ fontSize: '0.8125rem', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-mono)', resize: 'vertical', width: '100%' }}
            />
          </div>
        </div>

      </SettingsBlock>

      {/* ── Modelo del sub-agente ──────────────────────────────── */}
      <SettingsBlock
        title="Modelo del sub-agente"
        expanded={sections.model}
        onToggle={() => setSections(p => ({ ...p, model: !p.model }))}
      >

        {/* Datalists para autocompletado — disponibles solo con credenciales */}
        <datalist id="am-model-list">
          {availableModels.map(k => <option key={k} value={k} />)}
        </datalist>
        <datalist id="am-model-fallback-list">
          {availableModels.map(k => <option key={k} value={k} />)}
        </datalist>

        {/* model */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Modelo</div>
            <div style={DESC}>Modelo dedicado para el sub-agente de recall (vacío = hereda del agente)</div>
          </div>
          <div style={CTRL_COL}>
            <input
              type="text"
              list="am-model-list"
              value={model}
              onChange={e => markDirty(setModel)(e.target.value)}
              disabled={formDisabled}
              placeholder="ej: google/gemini-3-flash"
              style={{ fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-mono)', width: '100%' }}
            />
          </div>
        </div>

        {/* modelFallback */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Modelo fallback</div>
            <div style={DESC}>Si el modelo principal falla o no está disponible</div>
          </div>
          <div style={CTRL_COL}>
            <input
              type="text"
              list="am-model-fallback-list"
              value={modelFallback}
              onChange={e => markDirty(setModelFallback)(e.target.value)}
              disabled={formDisabled}
              placeholder="ej: custom-api-deepseek-com/deepseek-v4-flash"
              style={{ fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-mono)', width: '100%' }}
            />
          </div>
        </div>

        {/* thinking */}
        <div style={{ ...ROW, borderBottom: 'none' }}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Thinking</div>
            <div style={DESC}>Nivel de razonamiento extendido del sub-agente</div>
          </div>
          <div style={CTRL_COL}>
            <select
              value={thinking}
              onChange={e => { setThinking(e.target.value); setDirty(true); }}
              disabled={formDisabled}
              style={{ fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            >
              {THINKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

      </SettingsBlock>

      {/* ── Avanzado ───────────────────────────────────────────── */}
      <SettingsBlock
        title="Avanzado"
        expanded={sections.advanced}
        onToggle={() => setSections(p => ({ ...p, advanced: !p.advanced }))}
      >

        {/* cacheTtlMs */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Cache TTL (ms)</div>
            <div style={DESC}>Reutilizar recalls idénticos durante N ms (1000-120000)</div>
          </div>
          <div style={CTRL_COL}>
            <input type="number" min={1000} max={120000}
              value={cacheTtlMs}
              onChange={e => markDirty(setCacheTtlMs)(Number(e.target.value))}
              disabled={formDisabled}
              style={{ width: 100, fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            />
          </div>
        </div>

        {/* circuitBreakerMaxTimeouts */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Circuit breaker — timeouts</div>
            <div style={DESC}>Saltar recall tras N timeouts consecutivos (1-20)</div>
          </div>
          <div style={CTRL_COL}>
            <input type="number" min={1} max={20}
              value={circuitBreakerMaxTimeouts}
              onChange={e => markDirty(setCircuitBreakerMaxTimeouts)(Number(e.target.value))}
              disabled={formDisabled}
              style={{ width: 80, fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            />
          </div>
        </div>

        {/* circuitBreakerCooldownMs */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Circuit breaker — cooldown (ms)</div>
            <div style={DESC}>Espera tras disparar el breaker (5000-600000)</div>
          </div>
          <div style={CTRL_COL}>
            <input type="number" min={5000} max={600000}
              value={circuitBreakerCooldownMs}
              onChange={e => markDirty(setCircuitBreakerCooldownMs)(Number(e.target.value))}
              disabled={formDisabled}
              style={{ width: 100, fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            />
          </div>
        </div>

        {/* setupGraceTimeoutMs */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Grace de arranque (ms)</div>
            <div style={DESC}>Tiempo extra en cold-start del modelo (0-30000)</div>
          </div>
          <div style={CTRL_COL}>
            <input type="number" min={0} max={30000}
              value={setupGraceTimeoutMs}
              onChange={e => markDirty(setSetupGraceTimeoutMs)(Number(e.target.value))}
              disabled={formDisabled}
              style={{ width: 100, fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
            />
          </div>
        </div>

        {/* logging */}
        <div style={ROW}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Logging</div>
            <div style={DESC}>Emitir logs del sub-agente de recall en el Gateway</div>
          </div>
          <div style={CTRL_COL}>
            <ToggleSwitch checked={loggingEnabled} onChange={markDirty(setLoggingEnabled)} disabled={formDisabled} />
          </div>
        </div>

        {/* persistTranscripts */}
        <div style={{ ...ROW, borderBottom: 'none' }}>
          <div style={LABEL_COL}>
            <div style={{ fontWeight: 500 }}>Guardar transcripts</div>
            <div style={DESC}>Persistir los transcripts del sub-agente de recall (útil para depuración)</div>
          </div>
          <div style={CTRL_COL}>
            <ToggleSwitch checked={persistTranscripts} onChange={markDirty(setPersistTranscripts)} disabled={formDisabled} />
          </div>
        </div>

      </SettingsBlock>

    </SectionShell>
  );
}
