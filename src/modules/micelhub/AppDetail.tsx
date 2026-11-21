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

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppIcon, resolveManifestIcon } from '@/components/shared/AppIcon';
import { getApp } from '@/services/apps.service';
import { api } from '@/services/api';
import * as gwService from '@/services/gateway.service';
import { useAuthStore } from '@/stores/auth.store';
import type { InstalledApp, AppManifest, AppRuntimeStatus } from '@/types/apps';
import { useI18n } from '@/i18n';
import { AppActionProgress, AppBadges, AppCatalogAction, InstallationSize, type AppPrimaryAction, type CatalogView } from './AppCatalogPresentation';

// Markdown components for README and SKILL.md tabs — handles overflow properly
const mdComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  pre: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ position: 'relative', margin: '8px 0' }}>
      <pre style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '12px 16px',
        overflow: 'auto', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', margin: 0,
      }}>
        {children}
      </pre>
    </div>
  ),
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    if (className?.startsWith('language-')) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code style={{
        background: 'var(--surface)', padding: '1px 4px',
        borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
      }} {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600 }}>
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
      {children}
    </td>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p style={{ margin: '6px 0', lineHeight: 1.5 }}>{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 style={{ margin: '12px 0 6px', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)' }}>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 style={{ margin: '10px 0 6px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 style={{ margin: '8px 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>{children}</h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li style={{ margin: '2px 0' }}>{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote style={{
      borderLeft: '2px solid var(--amber)', paddingLeft: 12,
      margin: '6px 0', color: 'var(--text-dim)',
    }}>
      {children}
    </blockquote>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>
      {children}
    </a>
  ),
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <img src={src} alt={alt} style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius-md)' }} />
  ),
} as Record<string, React.ComponentType<Record<string, unknown>>>;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AppDetailProps {
  app: InstalledApp;
  onBack: () => void;
  onRefresh: () => void;
  onEditFiles?: () => void;
  origin?: string;
  catalogView?: CatalogView;
  primaryAction?: AppPrimaryAction;
}

type DetailTab = 'readme' | 'skill' | 'config';

const LEVEL_STYLES: Record<string, { border: string; color: string }> = {
  '1': { border: 'var(--text-dim)', color: 'var(--text-dim)' },
  '2': { border: '#3b82f6', color: '#3b82f6' },
  '3': { border: '#a855f7', color: '#a855f7' },
};

const currentPrincipal = () => {
  const { user, sessionGeneration } = useAuthStore.getState();
  return `${user?.id ?? ''}:${sessionGeneration}:${user?.role ?? ''}`;
};

export function AppDetail({ app, onBack, onRefresh, origin, catalogView = app.status === 'active' ? 'installed' : 'available', primaryAction }: AppDetailProps) {
  const { t } = useI18n();
  const principal = useAuthStore((state) => `${state.user?.id ?? ''}:${state.sessionGeneration}:${state.user?.role ?? ''}`);
  const selectionKey = `${principal}:${app.id}:${app.app_name}:${app.version}`;
  const activeSelection = useRef(selectionKey);

  const [activeTab, setActiveTab] = useState<DetailTab>('readme');
  const [manifest, setManifest] = useState<AppManifest>(app.manifest);
  const [runtime, setRuntime] = useState<AppRuntimeStatus | null>(null);

  // SKILL.md and README.md content (loaded from backend)
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);

  // Registry packages (source='registry'): README + lista de ficheros del .claw, traídos de
  // GET /apps/registry/:name. Es la info que antes vivía en el panel propio de RegistryBrowser
  // (ahora hay UN solo panel: este). `registryAvailable` = paquete del store NO instalado.
  const isRegistry = app.source === 'registry';
  const canManage = useAuthStore(s => s.user?.role === 'admin' || s.user?.role === 'owner');
  const registryAvailable = isRegistry && (app.manifest?.tags ?? []).includes('registry-available');
  const registryPublic = isRegistry && (app.manifest?.tags ?? []).includes('registry-public');
  const [packageFiles, setPackageFiles] = useState<Array<{ path: string; size: number }> | null>(null);
  const [registryReadme, setRegistryReadme] = useState<string | null>(null);

  // Skill status from OpenClaw (deps, eligibility, install options)
  const [skillStatus, setSkillStatus] = useState<gwService.SkillStatus | null>(null);

  // Config tab state
  const [configEnabled, setConfigEnabled] = useState(true);
  const [configApiKey, setConfigApiKey] = useState('');
  const [configEnv, setConfigEnv] = useState<Record<string, string>>({});
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Keep the selected content tab, but isolate every response by actor and version.
  useEffect(() => {
    let active = true;
    activeSelection.current = selectionKey;
    setManifest(app.manifest);
    setRuntime(null);
    if (!registryAvailable && canManage) {
      void getApp(app.app_name).then((detail) => {
        if (!active || currentPrincipal() !== principal || activeSelection.current !== selectionKey || detail.version !== app.version) return;
        setManifest({ ...detail.manifest, tags: [...new Set([
          ...(detail.manifest.tags ?? []),
          ...(app.manifest?.tags ?? []).filter(tag => tag === 'verified' || tag === 'featured'),
        ])] });
        setRuntime(detail.runtime);
      }).catch(() => { /* keep the catalogue manifest */ });
    }
    return () => { active = false; if (activeSelection.current === selectionKey) activeSelection.current = ''; };
  }, [selectionKey, app.app_name, app.version, app.manifest, registryAvailable, canManage, principal]);

  useEffect(() => {
    let active = true;
    const current = () => active && currentPrincipal() === principal && activeSelection.current === selectionKey;
    setSkillContent(null);
    setReadmeContent(null);
    setSkillStatus(null);
    if (!registryAvailable && canManage) {
      void Promise.all([
        api.get<{ data: { content: string | null } }>(`/gateway/skill-file/${app.app_name}/SKILL.md`).catch(() => ({ data: { content: null } })),
        api.get<{ data: { content: string | null } }>(`/gateway/skill-file/${app.app_name}/README.md`).catch(() => ({ data: { content: null } })),
        gwService.getSkillsStatus().catch(() => []),
      ]).then(([skillRes, readmeRes, allStatuses]) => {
        if (!current()) return;
        setSkillContent(skillRes.data.content);
        setReadmeContent(readmeRes.data.content);
        const bareId = app.app_name.replace(/^claw-/, '');
        const found = allStatuses.find((item) => item.name === app.app_name || item.name === bareId || item.skill_key === app.app_name || item.skill_key === bareId);
        setSkillStatus(found ?? null);
      });
    }
    return () => { active = false; };
  }, [selectionKey, app.app_name, app.version, registryAvailable, canManage, principal]);

  // Registry detail is explicitly versioned and must never populate another selection.
  useEffect(() => {
    let active = true;
    setPackageFiles(null);
    setRegistryReadme(null);
    if (isRegistry && !registryPublic && canManage) {
      void api.get<{ data: { version: string; readme?: string; files?: Array<{ path: string; size: number }> } }>(`/apps/registry/${app.app_name}`, { version: app.version }).then((res) => {
        if (!active || currentPrincipal() !== principal || activeSelection.current !== selectionKey || res.data.version !== app.version) return;
        setPackageFiles(res.data.files ?? []);
        setRegistryReadme(res.data.readme ?? null);
      }).catch(() => { /* package details are optional */ });
    }
    return () => { active = false; };
  }, [selectionKey, app.app_name, app.version, isRegistry, registryPublic, canManage, principal]);

  // Configuration drafts cannot carry over to another actor, app or version.
  useEffect(() => {
    let active = true;
    setConfigEnabled(true);
    setConfigApiKey('');
    setConfigEnv({});
    setConfigDirty(false);
    setConfigSaving(false);
    if (app.source === 'openclaw' && canManage) {
      void gwService.getSkillsConfig().then((config) => {
        if (!active || currentPrincipal() !== principal || activeSelection.current !== selectionKey) return;
        const entries = (config.entries ?? {}) as Record<string, Record<string, unknown>>;
        const entry = entries[app.app_name] ?? entries[app.app_name.replace('claw-', '')] ?? {};
        setConfigEnabled(entry.enabled !== false);
        setConfigApiKey((entry.api_key ?? '') as string);
        setConfigEnv((entry.env ?? {}) as Record<string, string>);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [selectionKey, app.app_name, app.version, app.source, canManage, principal]);

  const handleSaveConfig = async () => {
    if (!canManage || currentPrincipal() !== principal) return;
    const current = () => currentPrincipal() === principal && activeSelection.current === selectionKey;
    setConfigSaving(true);
    try {
      if (app.source === 'openclaw') {
        await gwService.updateSkillsConfig({
          entries: { [app.app_name]: { enabled: configEnabled, ...(configApiKey ? { apiKey: configApiKey } : {}), ...(Object.keys(configEnv).length > 0 ? { env: configEnv } : {}) } },
        });
      }
      if (!current()) return;
      toast.success('Config saved');
      setConfigDirty(false);
      onRefresh();
    } catch { if (current()) toast.error('Failed to save config'); }
    finally { if (current()) setConfigSaving(false); }
  };

  const levelStyle = LEVEL_STYLES[String(app.app_level)] ?? LEVEL_STYLES['1'];

  return (
    <div role="region" aria-label={manifest?.name || app.app_name} data-app-name={app.app_name} data-app-version={app.version} data-catalog-view={catalogView} style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-sans)', minWidth: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            aria-label={t('micelhub.back')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 2, display: 'flex',
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <span style={{ display: 'inline-flex', flexShrink: 0 }}><AppIcon {...resolveManifestIcon(manifest)} size={18} /></span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', flex: 1 }}>
            {manifest?.name || app.app_name}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: levelStyle?.border, color: levelStyle?.color }}
          >
            L{app.app_level}
          </Badge>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-dim)]">
          {manifest?.author && <span className="min-w-0 truncate">{manifest.author}</span>}
          <span>v{app.version}</span>
          {catalogView === 'installed' && <span className="ml-auto"><InstallationSize app={app} /></span>}
        </div>
        <AppBadges app={{ ...app, manifest }} origin={origin} />
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {(['readme', 'skill', 'config'] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === t ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === t ? 'var(--text)' : 'var(--text-dim)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: activeTab === t ? 500 : 400,
            }}
          >
            {t === 'readme' && 'README'}
            {t === 'skill' && 'SKILL.md'}
            {t === 'config' && 'Config'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1 app-detail-scroll">
        <div className="app-detail-content">
          {activeTab === 'readme' && (
            <div className="app-detail-md">
              <MarkdownRenderer
                content={readmeContent || registryReadme || manifest?.description || `# ${manifest?.name || app.app_name}\n\nNo README available.`}
                components={mdComponents}
              />

              {/* Ficheros del paquete (.claw) — solo apps del registry. Fundido aquí desde el
                  panel propio de RegistryBrowser (ahora hay un único panel de detalles). */}
              {packageFiles && packageFiles.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.04em' }}>
                    Archivos del paquete ({packageFiles.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {packageFiles.map((f) => (
                      <div key={f.path} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        fontSize: '0.72rem', padding: '3px 6px', borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{formatSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'skill' && (
            <div className="app-detail-md">
              <MarkdownRenderer
                content={(skillContent?.replace(/^---\n[\s\S]*?\n---\s*/, '')
                  ?? (registryAvailable ? '_El SKILL.md estará disponible al instalar el paquete (ver README)._' : '_Loading SKILL.md..._')).trim()}
                components={mdComponents}
              />
            </div>
          )}

          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* OS not supported */}
              {(skillStatus?.missing?.os?.length ?? 0) > 0 && (
                <div style={{ padding: '12px 14px', background: '#ef444410', border: '1px solid #ef444425', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#ef4444', fontWeight: 500 }}>
                    {t('micelhub.onlyOnPlatforms', { platforms: skillStatus?.requirements?.os?.join(', ') || 'other platforms' })}
                  </span>
                </div>
              )}

              {/* Dependencies (binary requirements) */}
              {(skillStatus?.requirements?.bins?.length ?? 0) > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('micelhub.dependencies')}</h4>
                  {skillStatus!.requirements.bins.map(bin => {
                    const isMissing = skillStatus!.missing.bins.includes(bin);
                    return (
                      <div key={bin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.8125rem', color: isMissing ? '#ef4444' : '#22c55e' }}>{isMissing ? '✗' : '✓'}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{bin}</span>
                        </div>
                        {isMissing && (skillStatus!.install?.length ?? 0) > 0 && (
                          <button onClick={async () => {
                            const installId = skillStatus!.install[0]!.id;
                            const tid = toast.loading(t('micelhub.installingDependency', { name: bin }));
                            try {
                              const result = await gwService.installAppDeps(skillStatus!.name, installId);
                              if (result.ok) { toast.success(t('micelhub.dependencyInstalled', { name: bin }), { id: tid }); }
                              else { toast.error(t('micelhub.installDependencyFailed', { reason: result.message }), { id: tid }); }
                            } catch { toast.error(t('micelhub.installFailed'), { id: tid }); }
                          }} style={{
                            padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 500,
                            background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-sm)',
                            color: '#000', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}>
                            Install ({skillStatus!.install[0]!.label || skillStatus!.install[0]!.kind})
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Required API keys / settings */}
              {(skillStatus?.requirements?.env?.length ?? 0) > 0 && skillStatus!.requirements.env.some(e => e !== 'CLAW_API_KEY' && e !== 'CLAW_CORE_TOKEN') && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('micelhub.requiredSettings')}</h4>
                  {skillStatus!.requirements.env.filter(e => e !== 'CLAW_API_KEY' && e !== 'CLAW_CORE_TOKEN').map(envVar => {
                    const isMissing = skillStatus!.missing.env.includes(envVar);
                    // User-friendly labels
                    const labels: Record<string, { label: string; hint: string }> = {
                      OPENAI_API_KEY: { label: 'OpenAI API Key', hint: 'Already configured in Settings → AI → API Keys' },
                      GEMINI_API_KEY: { label: 'Google Gemini API Key', hint: 'Get from Google AI Studio' },
                      NOTION_API_KEY: { label: 'Notion API Key', hint: 'Get from notion.so/my-integrations' },
                      TRELLO_API_KEY: { label: 'Trello API Key', hint: 'Get from trello.com/app-key' },
                      TRELLO_TOKEN: { label: 'Trello Token', hint: 'Get from Trello developer portal' },
                      ELEVENLABS_API_KEY: { label: 'ElevenLabs API Key', hint: 'Get from elevenlabs.io' },
                      GOOGLE_PLACES_API_KEY: { label: 'Google Places API Key', hint: 'Get from Google Cloud Console' },
                    };
                    const info = labels[envVar] ?? { label: envVar, hint: '' };
                    return (
                      <div key={envVar} style={{ padding: '6px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.8125rem', color: isMissing ? 'var(--amber)' : '#22c55e' }}>{isMissing ? '🔑' : '✓'}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{info.label}</span>
                        </div>
                        {isMissing && info.hint && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 22 }}>{info.hint}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Required channel configuration */}
              {(skillStatus?.requirements?.config?.length ?? 0) > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('micelhub.requiredConfiguration')}</h4>
                  {skillStatus!.requirements.config.map(cfg => {
                    const isMissing = skillStatus!.missing.config.includes(cfg);
                    const channelMatch = cfg.match(/channels\.(\w+)/);
                    return (
                      <div key={cfg} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                        <span style={{ fontSize: '0.8125rem', color: isMissing ? 'var(--amber)' : '#22c55e' }}>{isMissing ? '⚠' : '✓'}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                          {channelMatch ? `Requires ${channelMatch[1]!.charAt(0).toUpperCase() + channelMatch[1]!.slice(1)} channel to be configured` : cfg}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* No requirements at all */}
              {!skillStatus && (
                <div style={{ padding: '16px 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                  Loading app configuration...
                </div>
              )}
              {skillStatus && (skillStatus.requirements?.bins?.length ?? 0) === 0 && (skillStatus.requirements?.env?.length ?? 0) === 0 && (skillStatus.requirements?.config?.length ?? 0) === 0 && (skillStatus.missing?.os?.length ?? 0) === 0 && (
                <div style={{ padding: '16px 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                  ✓ This app has no additional configuration needed. Ready to use.
                </div>
              )}

              {/* Enable/disable toggle — solo para skills bundled de OpenClaw (handleSaveConfig solo
                  persiste su entries; para el resto sería un no-op que muestra "Config saved" falso). */}
              {app.source === 'openclaw' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                    <div>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{t('micelhub.enabled')}</span>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{t('micelhub.disabledHint')}</div>
                    </div>
                    <div onClick={() => { setConfigEnabled(!configEnabled); setConfigDirty(true); }} style={{
                      width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                      background: configEnabled ? 'var(--success, #22c55e)' : 'var(--text-muted)',
                      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: configEnabled ? 18 : 2, transition: 'left 0.2s' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Save */}
              {configDirty && (
                <button onClick={handleSaveConfig} disabled={configSaving} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600,
                  background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-sm)',
                  color: '#000', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  opacity: configSaving ? 0.7 : 1,
                }}>
                  <Save size={14} /> {configSaving ? t('micelhub.saving') : t('micelhub.save')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Permissions section */}
        {manifest?.permissions && manifest.permissions.length > 0 && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
          }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('micelhub.permissions')}
            </h4>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {manifest.permissions.map((p) => (
                <span key={p} style={{
                  fontSize: '0.6875rem', padding: '2px 8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)', color: 'var(--text-dim)',
                }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Runtime status */}
        {runtime && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            fontSize: '0.6875rem', color: 'var(--text-dim)',
            display: 'flex', gap: 12,
          }}>
            <span>{t('micelhub.status')}: <strong style={{ color: runtime.status === 'loaded' ? 'var(--success)' : 'var(--error)' }}>{runtime.status}</strong></span>
            <span>{t('micelhub.routes')}: {runtime.routes_registered}</span>
            <span>{t('micelhub.tables')}: {runtime.tables_created}</span>
            {runtime.containers_running !== undefined && <span>{t('micelhub.containers')}: {runtime.containers_running}</span>}
          </div>
        )}
      </ScrollArea>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3">
        <AppActionProgress action={primaryAction} />
        <div className="flex justify-end">
          {primaryAction ? <AppCatalogAction view={catalogView} action={primaryAction} /> : !canManage && <span className="text-xs text-[var(--text-muted)]">{t('micelhub.registryAdminRequired')}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Fork Name Dialog ───────────────────────────────────────────────

export function ForkNameDialog({ suggestedName, onConfirm, onClose }: {
  suggestedName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(suggestedName);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent style={{ width: 'calc(100vw - 32px)', maxWidth: 360 }} onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); handleConfirm(); }}>
        <DialogHeader><DialogTitle className="pr-4 text-base">{t('micelhub.forkName')}</DialogTitle><DialogDescription>{t('micelhub.forkTitle')}</DialogDescription></DialogHeader>
        <label className="sr-only" htmlFor="micelhub-fork-name">{t('micelhub.forkNamePlaceholder')}</label>
        <Input id="micelhub-fork-name" ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={t('micelhub.forkNamePlaceholder')} />
        <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={onClose}>{t('micelhub.cancelChanges')}</Button><Button type="submit" disabled={!value.trim()}>{t('micelhub.fork')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
