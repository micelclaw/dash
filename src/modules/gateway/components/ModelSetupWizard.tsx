/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState } from 'react';
import { X, Loader2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { getProviderIcon } from '@/config/provider-icons';
import type { CatalogModel } from '../types';

export type ProviderType = 'custom' | 'ollama' | 'sglang' | 'vllm' | 'lm-studio';

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

// Provider-specific copy: where to get an API key. Hardcoded because the
// CLI catalog doesn't surface this info per provider, but the list is
// short and easy to maintain.
const PROVIDER_INFO: Record<string, { label: string; signupUrl?: string; tokenPrefix?: string; description: string }> = {
  anthropic: {
    label: 'Anthropic',
    signupUrl: 'https://console.anthropic.com/settings/keys',
    tokenPrefix: 'sk-ant-',
    description: 'Claude models — Opus 4.8 for the hardest tasks, Sonnet 4.6 for everyday work, Haiku 4.5 for fast cheap turns. Pay-as-you-go.',
  },
  openai: {
    label: 'OpenAI',
    signupUrl: 'https://platform.openai.com/api-keys',
    tokenPrefix: 'sk-',
    description: 'Create an API key in your OpenAI dashboard. Pay-as-you-go billing.',
  },
  openrouter: {
    label: 'OpenRouter',
    signupUrl: 'https://openrouter.ai/keys',
    tokenPrefix: 'sk-or-',
    description: 'Aggregator that lets you use models from many providers with a single key.',
  },
  groq: {
    label: 'Groq',
    signupUrl: 'https://console.groq.com/keys',
    tokenPrefix: 'gsk_',
    description: 'Very fast inference for open-weight models. Free tier available.',
  },
  xai: {
    label: 'xAI',
    signupUrl: 'https://console.x.ai/',
    tokenPrefix: 'xai-',
    description: 'Grok models (Grok 4, Grok Code) including web search and code execution tools. Sign in with your X account if you prefer not to manage an API key.',
  },
  deepseek: {
    label: 'DeepSeek',
    signupUrl: 'https://platform.deepseek.com/api_keys',
    tokenPrefix: 'sk-',
    description: 'DeepSeek\u2019s native API. Cheap reasoning models.',
  },
  mistral: {
    label: 'Mistral',
    signupUrl: 'https://console.mistral.ai/api-keys',
    tokenPrefix: '',
    description: 'Mistral AI models.',
  },
  google: {
    label: 'Google AI Studio',
    signupUrl: 'https://aistudio.google.com/apikey',
    tokenPrefix: 'AIza',
    description: 'Gemini models via Google AI Studio.',
  },
  cohere: {
    label: 'Cohere',
    signupUrl: 'https://dashboard.cohere.com/api-keys',
    tokenPrefix: '',
    description: 'Cohere\u2019s text and embedding models.',
  },
  // \u2500\u2500 New bundled providers in OpenClaw 2026.5.7 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Same shape as the rest \u2014 OpenClaw knows each baseUrl natively
  // (see `extensions/<id>/onboard.ts` in the bundled binary). Only the
  // signup link + token-format hint are dash-side metadata.
  cerebras: {
    label: 'Cerebras',
    signupUrl: 'https://cloud.cerebras.ai/platform/',
    tokenPrefix: 'csk-',
    description: 'Ultra-fast inference for Llama, Qwen, GLM-4.7 and others. Free tier available.',
  },
  nvidia: {
    label: 'NVIDIA',
    signupUrl: 'https://build.nvidia.com/',
    tokenPrefix: 'nvapi-',
    description: 'Featured catalog of hosted open models \u2014 Nemotron Ultra, Llama Nemotron, Qwen Coder, and others. Free credits to start.',
  },
  arcee: {
    label: 'Arcee AI',
    signupUrl: 'https://models.arcee.ai/',
    tokenPrefix: '',
    description: 'Small/medium specialised models (Trinity, Coder, Spark, SuperNova).',
  },
  deepinfra: {
    label: 'DeepInfra',
    signupUrl: 'https://deepinfra.com/dash/api_keys',
    tokenPrefix: '',
    description: 'Hosted open-source models (Llama, Mixtral, DeepSeek, BGE, etc.) at low cost.',
  },
  // ── Added in OpenClaw 2026.5.17 → 2026.5.28 ───────────────────
  fal: {
    label: 'Fal',
    signupUrl: 'https://fal.ai/dashboard/keys',
    tokenPrefix: '',
    description: 'Image and video generation — Krea models, Flux family, SDXL, and more. Use when an agent needs to make visuals.',
  },
  minimax: {
    label: 'MiniMax',
    signupUrl: 'https://www.minimax.io/',
    tokenPrefix: '',
    description: 'M2 series (M2.5 reasoning, M2.6) plus Music — the only mainstream provider that streams full songs back. Strong on Chinese.',
  },
};

const CUSTOM_PROVIDER_PREFIX = 'custom-api-';

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

export function ModelSetupWizard({ model, providerType, providerModels, onClose, onSuccess }: ModelSetupWizardProps) {
  // Standalone mode with specific provider type (user clicked a type card)
  if (!model && providerType) {
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
  if (model.provider.startsWith(CUSTOM_PROVIDER_PREFIX)) {
    return <CustomProviderForm model={model} onClose={onClose} onSuccess={onSuccess} />;
  }
  return <StandardProviderForm model={model} providerModels={providerModels} onClose={onClose} onSuccess={onSuccess} />;
}

// ─── Standard provider form (Anthropic, OpenAI, etc.) ──────────────

function StandardProviderForm({ model, providerModels, onClose, onSuccess }: ModelSetupWizardProps & { model: CatalogModel }) {
  const info = PROVIDER_INFO[model.provider] ?? {
    label: model.provider,
    description: `Configure an API key for ${model.provider}.`,
  };
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingModel, setAddingModel] = useState(false);

  const canSave = token.trim().length >= 8;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // 1. Save the token via the new auth endpoint
      await gwService.setAuthToken({ provider: model.provider, token: token.trim() });
      toast.success(`${info.label} credentials saved`);

      // 2. If the model wasn't already configured, add it now
      if (!model.configured) {
        setAddingModel(true);
        await gwService.addModel(model.key);
        toast.success(`${model.name || model.key} added to your models`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to configure provider';
      toast.error(msg);
    } finally {
      setSaving(false);
      setAddingModel(false);
    }
  };

  return (
    <ModalShell
      title={`Configure ${info.label}`}
      titleIcon={(() => {
        const Icon = getProviderIcon(model.provider);
        return Icon ? <Icon size={26} style={{ color: 'var(--amber)' }} /> : null;
      })()}
      onClose={onClose}
    >
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        {info.description}
      </p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6 }}>
        Needed for: <strong style={{ color: 'var(--text)' }}>{model.name || model.key}</strong>
      </p>

      {info.signupUrl && (
        <div style={{ marginBottom: 16 }}>
          <a
            href={info.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.75rem',
              color: 'var(--amber)',
              textDecoration: 'none',
              padding: '6px 10px',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Get an API key from {info.label} <ExternalLink size={12} />
          </a>
        </div>
      )}

      <label style={{
        display: 'block',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        marginBottom: 6,
        fontFamily: 'var(--font-sans)',
      }}>
        Paste your API key:
      </label>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          type={showToken ? 'text' : 'password'}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={info.tokenPrefix ? `${info.tokenPrefix}...` : 'paste here'}
          autoFocus
          style={{
            width: '100%',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 36px 10px 12px',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setShowToken(!showToken)}
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
          {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <p style={{
        fontSize: '0.6875rem',
        color: 'var(--text-dim)',
        background: 'var(--surface)',
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        marginBottom: 16,
        lineHeight: 1.4,
      }}>
        🔒 This key is stored locally in your agents' auth profile files (<code style={{ fontFamily: 'var(--font-mono)' }}>~/.openclaw/agents/&lt;you&gt;--&lt;agent&gt;/agent/auth-profiles.json</code>) and never sent anywhere except {info.label} when you make a model call.
      </p>

      <ButtonRow
        cancelLabel="Cancel"
        confirmLabel={addingModel ? 'Adding model...' : saving ? 'Saving...' : 'Save & Add'}
        onCancel={onClose}
        onConfirm={handleSave}
        confirmDisabled={!canSave || saving}
        loading={saving}
      />

      <ProviderModelsList models={providerModels} providerLabel={info.label} />
    </ModalShell>
  );
}

// ─── Custom provider form (custom-api-*) ────────────────────────────

function CustomProviderForm({ model, onClose, onSuccess }: ModelSetupWizardProps) {
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
      toast.success(`Custom provider ${providerId} configured`);

      // If opened from a catalog model, add that model too
      if (model && !model.configured) {
        await gwService.addModel(model.key);
        toast.success(`${model.name || model.key} added`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to configure custom provider';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Set up custom provider" onClose={onClose}>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        Configure an OpenAI-compatible API endpoint. Works with self-hosted LLMs (LiteLLM, vLLM, Ollama-compat) and providers like DeepSeek that expose an OpenAI-style API.
      </p>
      {model && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12 }}>
          Adding: <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{model.name || model.key}</strong>
        </p>
      )}

      <Field label="Provider ID">
        <input
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          placeholder="custom-api-mycompany-com"
          style={inputStyle}
        />
      </Field>

      <Field label="API Base URL">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          style={inputStyle}
        />
      </Field>

      <Field label="API Key">
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

      <Field label="API Format">
        <select
          value={apiFormat}
          onChange={(e) => setApiFormat(e.target.value)}
          style={inputStyle}
        >
          <option value="openai-completions">OpenAI Completions (most compatible)</option>
          <option value="anthropic-messages">Anthropic Messages</option>
          <option value="ollama">Ollama</option>
          <option value="google-generative-ai">Google Generative AI</option>
        </select>
      </Field>

      <ButtonRow
        cancelLabel="Cancel"
        confirmLabel={saving ? 'Saving...' : 'Save & Add'}
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
  const [baseUrl, setBaseUrl] = useState(defaults.baseUrl);
  const [apiKey, setApiKey] = useState(defaults.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = baseUrl.trim() && (!defaults.apiKeyRequired || apiKey.trim().length >= 1);

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState('');

  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');
    try {
      // Try discover endpoint — it probes the provider's URL server-side
      await gwService.discoverProviderModels(defaults.providerId);
      setConnectionStatus('ok');
    } catch {
      // Provider not saved yet, so discover will 404. Instead, just save and
      // let discover run post-save. We validate the URL format only.
      try {
        new URL(baseUrl);
        setConnectionStatus('idle');
      } catch {
        setConnectionStatus('error');
        setConnectionError('Invalid URL format');
      }
    }
  };

  const handleSave = async () => {
    if (!canSave) return;

    // Validate URL format
    try {
      new URL(baseUrl);
    } catch {
      toast.error('Invalid Base URL — please enter a valid URL');
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
          toast.success(`${defaults.label} configured — ${result.models.length} model${result.models.length !== 1 ? 's' : ''} found`);
        } else {
          toast.success(`${defaults.label} configured`);
          toast.warning(`Could not reach ${defaults.label} at ${baseUrl} — check that the server is running and the URL is correct`, { duration: 8000 });
        }
      } catch {
        toast.success(`${defaults.label} configured`);
        toast.warning(`Could not reach ${defaults.label} at ${baseUrl} — check that the server is running and the URL is correct`, { duration: 8000 });
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to configure ${defaults.label}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={`Set up ${defaults.label}`}
      titleIcon={(() => {
        const Icon = getProviderIcon(defaults.providerId);
        return Icon ? <Icon size={26} style={{ color: 'var(--amber)' }} /> : null;
      })()}
      onClose={onClose}
    >
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        Configure the connection to your {defaults.label} instance.
      </p>

      <Field label="Base URL">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={defaults.baseUrl}
          autoFocus
          style={inputStyle}
        />
      </Field>

      <Field label={defaults.apiKeyRequired ? 'API Key' : 'API Key (optional)'}>
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={defaults.apiKeyPlaceholder}
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
        Provider ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{defaults.providerId}</code> · API type: <code style={{ fontFamily: 'var(--font-mono)' }}>{defaults.apiType}</code>
      </p>

      <ButtonRow
        cancelLabel="Cancel"
        confirmLabel={saving ? 'Saving...' : 'Save'}
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
