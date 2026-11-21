/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState } from 'react';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { getProviderIcon } from '@/config/provider-icons';
import { describeCredentialError } from '../lib/credential-errors';
import { OmniRouteSetupWizard } from './OmniRouteSetupWizard';
import type { CatalogModel } from '../types';
import { useI18n } from '@/i18n';

export type ProviderType =
  | 'custom'
  | 'ollama'
  | 'sglang'
  | 'vllm'
  | 'lm-studio'
  | 'omniroute';

interface ModelSetupWizardProps {
  model: CatalogModel | null;
  providerType?: ProviderType;
  /** Modelos del catálogo que pertenecen al provider del wizard. Se
   *  muestran en la zona inferior del modal a doble columna para que
   *  el usuario vea qué obtiene al configurar las credenciales. */
  providerModels?: CatalogModel[];
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Fixed provider defaults (OpenClaw CLI alignment) ──────────────

interface FixedProviderDefaults {
  label: string;
  providerId: string;
  baseUrl: string;
  apiType: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  apiKeyRequired: boolean;
}

const FIXED_PROVIDER_DEFAULTS: Record<string, FixedProviderDefaults> = {
  ollama: {
    label: 'Ollama',
    providerId: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    apiType: 'ollama',
    apiKey: 'ollama-local',
    apiKeyPlaceholder: 'Leave default for local Ollama',
    apiKeyRequired: false,
  },
  vllm: {
    label: 'vLLM',
    providerId: 'vllm',
    baseUrl: 'http://127.0.0.1:8000/v1',
    apiType: 'openai-completions',
    apiKey: '',
    apiKeyPlaceholder: 'sk-...',
    apiKeyRequired: true,
  },
  sglang: {
    label: 'SGLang',
    providerId: 'sglang',
    baseUrl: 'http://127.0.0.1:30000/v1',
    apiType: 'openai-completions',
    apiKey: '',
    apiKeyPlaceholder: 'sk-...',
    apiKeyRequired: true,
  },
  'lm-studio': {
    label: 'LM Studio',
    providerId: 'lm-studio',
    baseUrl: 'http://127.0.0.1:1234',
    apiType: 'openai-completions',
    apiKey: '',
    apiKeyPlaceholder: 'LM Studio API token (if auth enabled)',
    apiKeyRequired: false,
  },
};

/**
 * Resuelve el `ProviderType` de un id de proveedor para abrir el formulario de
 * alta de las extensiones explícitamente gestionadas por Micelclaw. Todos los
 * proveedores OpenClaw usan ProviderAuthWizard y nunca llegan a este fallback.
 */
export function providerTypeForId(id: string): ProviderType {
  if (id === 'omniroute') return 'omniroute';
  if (FIXED_PROVIDER_DEFAULTS[id]) return id as ProviderType;
  return 'custom';
}

export function ModelSetupWizard({ model, providerType, providerModels, onClose, onSuccess }: ModelSetupWizardProps) {
  // Standalone mode with specific provider type (user clicked a type card)
  if (!model && providerType) {
    // OmniRoute: no es "pega tu API key" — instala el gateway local y apunta OpenClaw a él.
    if (providerType === 'omniroute') {
      return <OmniRouteSetupWizard onClose={onClose} onSuccess={onSuccess} />;
    }
    const defaults = FIXED_PROVIDER_DEFAULTS[providerType];
    if (defaults) {
      return <FixedProviderForm defaults={defaults} providerModels={providerModels} onClose={onClose} onSuccess={onSuccess} />;
    }
    // 'custom' type falls through to CustomProviderForm
    return <CustomProviderForm model={null} onClose={onClose} onSuccess={onSuccess} />;
  }
  // Standalone custom provider mode (no type specified)
  if (!model) {
    return <CustomProviderForm model={null} onClose={onClose} onSuccess={onSuccess} />;
  }
  const fixed = FIXED_PROVIDER_DEFAULTS[model.provider];
  if (fixed) {
    return <FixedProviderForm defaults={fixed} providerModels={providerModels} onClose={onClose} onSuccess={onSuccess} />;
  }
  return <CustomProviderForm model={model} onClose={onClose} onSuccess={onSuccess} />;
}


// ─── Custom provider form (custom-api-*) ────────────────────────────

function CustomProviderForm({ model, onClose, onSuccess }: ModelSetupWizardProps) {
  const { t } = useI18n();
  // For custom providers we need: provider id, base URL, API key, API format.
  // When model is null, this is standalone mode (no pre-selected catalog model).
  // When model is set, the provider ID comes from model.provider.
  const [providerId, setProviderId] = useState(model?.provider ?? '');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiFormat, setApiFormat] = useState('openai-completions');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = providerId.trim() && baseUrl.trim() && apiKey.trim().length >= 8;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Custom providers go through PATCH /gateway/providers-config
      // (writes models.providers[id] in openclaw.json directly)
      await gwService.updateProvidersConfig({
        models: {
          providers: {
            [providerId]: {
              baseUrl,
              apiKey,
              api: apiFormat,
              models: [],
            },
          },
        },
      });
      toast.success(t('gateway.modelSetup.providerConfigured', { provider: providerId }));
    } catch (err) {
      // El provider NO se guardó → modal abierto para reintentar.
      toast.error(describeCredentialError(err, t('gateway.modelSetup.saveFailed')));
      setSaving(false);
      return;
    }

    // If opened from a catalog model, add that model too. Fallo parcial: la
    // credencial/entrada SÍ se guardó → onSuccess (refetch) igualmente, con
    // toast preciso de qué mitad falló.
    if (model && !model.configured) {
      try {
        await gwService.addModel(model.key);
        toast.success(t('gateway.modelSetup.modelAdded', { model: model.name || model.key }));
      } catch (err) {
        toast.error(t('gateway.modelSetup.partialAddFailed', { error: describeCredentialError(err, 'unknown error') }));
      }
    }

    setSaving(false);
    onSuccess();
    onClose();
  };

  return (
    <ModalShell title={t('gateway.modelSetup.customTitle')} onClose={onClose}>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('gateway.modelSetup.customDescription')}
      </p>
      {model && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12 }}>
          {t('gateway.modelSetup.addingModel')} <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{model.name || model.key}</strong>
        </p>
      )}

      <Field label={t('gateway.modelSetup.providerId')}>
        <input
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          placeholder={t('gateway.modelSetup.providerIdPlaceholder')}
          style={inputStyle}
        />
      </Field>

      <Field label={t('gateway.modelSetup.baseUrl')}>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={t('gateway.modelSetup.baseUrlPlaceholder')}
          style={inputStyle}
        />
      </Field>

      <Field label={t('gateway.modelSetup.apiKey')}>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{ ...inputStyle, paddingRight: 36 }}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex',
              padding: 4,
            }}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>

      <Field label={t('gateway.modelSetup.apiFormat')}>
        <select
          value={apiFormat}
          onChange={(e) => setApiFormat(e.target.value)}
          style={inputStyle}
        >
          <option value="openai-completions">{t('gateway.modelSetup.openaiFormat')}</option>
          <option value="anthropic-messages">{t('gateway.modelSetup.anthropicFormat')}</option>
          <option value="ollama">Ollama</option>
          <option value="google-generative-ai">{t('gateway.modelSetup.googleApi')}</option>
        </select>
      </Field>

      <ButtonRow
        cancelLabel={t('gateway.modelSetup.cancel')}
        confirmLabel={saving ? t('gateway.modelSetup.saving') : t('gateway.modelSetup.saveAdd')}
        onCancel={onClose}
        onConfirm={handleSave}
        confirmDisabled={!canSave || saving}
        loading={saving}
      />
    </ModalShell>
  );
}

// ─── Fixed provider form (Ollama, vLLM, SGLang, LM Studio) ────────

function FixedProviderForm({ defaults, providerModels, onClose, onSuccess }: {
  providerModels?: CatalogModel[];
  defaults: FixedProviderDefaults;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [baseUrl, setBaseUrl] = useState(defaults.baseUrl);
  const [apiKey, setApiKey] = useState(defaults.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = baseUrl.trim() && (!defaults.apiKeyRequired || apiKey.trim().length >= 1);

  const handleSave = async () => {
    if (!canSave) return;

    // Validate URL format
    try {
      new URL(baseUrl);
    } catch {
      toast.error(t('gateway.modelSetup.invalidBaseUrl'));
      return;
    }

    setSaving(true);
    try {
      const providerConfig: Record<string, unknown> = {
        baseUrl,
        api: defaults.apiType,
        models: [],
      };
      if (apiKey) providerConfig.apiKey = apiKey;
      await gwService.updateProvidersConfig({
        models: { providers: { [defaults.providerId]: providerConfig } },
      });

      // Post-save: test if the provider is reachable via discover
      try {
        const result = await gwService.discoverProviderModels(defaults.providerId);
        if (result.models.length > 0) {
          toast.success(t('gateway.modelSetup.configuredModels', { provider: defaults.label, count: result.models.length }));
        } else {
          toast.success(t('gateway.modelSetup.configured', { provider: defaults.label }));
          toast.warning(t('gateway.modelSetup.unreachable', { provider: defaults.label, url: baseUrl }), { duration: 8000 });
        }
      } catch {
        toast.success(t('gateway.modelSetup.configured', { provider: defaults.label }));
        toast.warning(t('gateway.modelSetup.unreachable', { provider: defaults.label, url: baseUrl }), { duration: 8000 });
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(describeCredentialError(err, t('gateway.modelSetup.configureFailed', { provider: defaults.label })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={t('gateway.modelSetup.fixedTitle', { provider: defaults.label })}
      titleIcon={(() => {
        const Icon = getProviderIcon(defaults.providerId);
        return Icon ? <Icon size={26} style={{ color: 'var(--amber)' }} /> : null;
      })()}
      onClose={onClose}
    >
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('gateway.modelSetup.fixedDescription', { provider: defaults.label })}
      </p>

      <Field label={t('gateway.modelSetup.baseUrlLabel')}>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={defaults.baseUrl}
          autoFocus
          style={inputStyle}
        />
      </Field>

      <Field label={defaults.apiKeyRequired ? t('gateway.modelSetup.apiKey') : t('gateway.modelSetup.apiKeyOptional')}>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={defaults.providerId === 'ollama' ? t('gateway.modelSetup.ollamaKeyPlaceholder') : defaults.apiKeyPlaceholder}
            style={{ ...inputStyle, paddingRight: 36 }}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', display: 'flex', padding: 4,
            }}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>

      <p style={{
        fontSize: '0.6875rem', color: 'var(--text-dim)',
        background: 'var(--surface)', padding: '8px 10px',
        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
        marginBottom: 16, lineHeight: 1.4,
      }}>
        {t('gateway.modelSetup.providerIdLabel')} <code style={{ fontFamily: 'var(--font-mono)' }}>{defaults.providerId}</code> · {t('gateway.modelSetup.apiTypeLabel')} <code style={{ fontFamily: 'var(--font-mono)' }}>{defaults.apiType}</code>
      </p>

      <ButtonRow
        cancelLabel={t('gateway.modelSetup.cancel')}
        confirmLabel={saving ? t('gateway.modelSetup.saving') : t('gateway.providerStatus.save')}
        onCancel={onClose}
        onConfirm={handleSave}
        confirmDisabled={!canSave || saving}
        loading={saving}
      />

      <ProviderModelsList models={providerModels} providerLabel={defaults.label} />
    </ModalShell>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        marginBottom: 6,
        fontFamily: 'var(--font-sans)',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ButtonRow({
  cancelLabel, confirmLabel, onCancel, onConfirm, confirmDisabled, loading,
}: {
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
      <button
        onClick={onCancel}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 16px',
          color: 'var(--text-dim)',
          fontSize: '0.75rem',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={confirmDisabled}
        style={{
          background: confirmDisabled ? 'var(--surface-hover)' : 'var(--amber)',
          color: confirmDisabled ? 'var(--text-dim)' : '#000',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 18px',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: confirmDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {loading && <Loader2 size={12} className="spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}


function ModalShell({ title, titleIcon, onClose, children }: { title: string; titleIcon?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          padding: 24,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            {titleIcon}
            <span>{title}</span>
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Provider models list (doble columna, footer) ───────────────────

function ProviderModelsList({ models, providerLabel }: { models?: CatalogModel[]; providerLabel: string }) {
  if (!models || models.length === 0) return null;

  // Sort: default first, then configured, then alphabetical
  const sorted = [...models].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    if (a.configured !== b.configured) return a.configured ? -1 : 1;
    return (a.name || a.key).localeCompare(b.name || b.key);
  });

  return (
    <div style={{
      marginTop: 20,
      paddingTop: 16,
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-dim)',
        marginBottom: 10,
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
      }}>
        {sorted.length} model{sorted.length !== 1 ? 's' : ''} from {providerLabel}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 12px',
        maxHeight: 200,
        overflowY: 'auto',
        fontFamily: 'var(--font-mono)',
      }}>
        {sorted.map((m) => (
          <div
            key={m.key}
            title={m.context_window ? `${m.context_window.toLocaleString()} ctx` : undefined}
            style={{
              fontSize: '0.6875rem',
              color: m.is_default ? 'var(--amber)' : 'var(--text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {m.is_default && <span style={{ color: 'var(--amber)' }}>★</span>}
            {m.configured && !m.is_default && <span style={{ color: '#10b981', fontSize: '0.625rem' }}>●</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {m.name || m.key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
