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

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Shield, ShieldAlert, Download, Power, Trash2, Save, Plus, Users, Copy, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getApp, scanApp, exportApp, updateAppStatus, uninstallApp, forkApp, suggestForkName, deleteApp,
} from '@/services/apps.service';
import { api } from '@/services/api';
import * as gwService from '@/services/gateway.service';
import { useAppsStore } from '@/stores/apps.store';
import type { InstalledApp, ScanResult, AppManifest, AppRuntimeStatus } from '@/types/apps';

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

interface AppDetailProps {
  app: InstalledApp;
  onBack: () => void;
  onRefresh: () => void;
  onEditFiles?: () => void;
}

type DetailTab = 'readme' | 'skill' | 'scan' | 'config';

const LEVEL_STYLES: Record<string, { border: string; color: string }> = {
  '1': { border: 'var(--text-dim)', color: 'var(--text-dim)' },
  '2': { border: '#3b82f6', color: '#3b82f6' },
  '3': { border: '#a855f7', color: '#a855f7' },
};

export function AppDetail({ app, onBack, onRefresh, onEditFiles }: AppDetailProps) {
  const setRestartRequired = useAppsStore((s) => s.setRestartRequired);

  const [activeTab, setActiveTab] = useState<DetailTab>('readme');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manifest, setManifest] = useState<AppManifest>(app.manifest);
  const [runtime, setRuntime] = useState<AppRuntimeStatus | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [purgeDialog, setPurgeDialog] = useState(false);

  // SKILL.md and README.md content (loaded from backend)
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);

  // Skill status from OpenClaw (deps, eligibility, install options)
  const [skillStatus, setSkillStatus] = useState<gwService.SkillStatus | null>(null);

  // Config tab state
  const [configEnabled, setConfigEnabled] = useState(true);
  const [configApiKey, setConfigApiKey] = useState('');
  const [configEnv, setConfigEnv] = useState<Record<string, string>>({});
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Agents assigned to this app
  const [assignedAgents, setAssignedAgents] = useState<Array<{ id: string; name: string; display_name: string; avatar: string | null }>>([]);
  const [allAgents, setAllAgents] = useState<Array<{ id: string; name: string; display_name: string; avatar: string | null; skills: Array<{ id: string }> }>>([]);

  // Reset state when app changes (keep activeTab to preserve user's current tab)
  useEffect(() => {
    setManifest(app.manifest);
    setRuntime(null);
    setScanResult(null);
    setSkillContent(null);
    setReadmeContent(null);
    setSkillStatus(null);
    // Fetch full detail
    getApp(app.app_name)
      .then((detail) => {
        setManifest(detail.manifest);
        setRuntime(detail.runtime);
      })
      .catch(() => { /* use existing manifest */ });
  }, [app.app_name, app.id]);

  // Fetch SKILL.md, README.md content, and skill status
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const [skillRes, readmeRes, allStatuses] = await Promise.all([
          api.get<{ data: { content: string | null } }>(`/gateway/skill-file/${app.app_name}/SKILL.md`).catch(() => ({ data: { content: null } })),
          api.get<{ data: { content: string | null } }>(`/gateway/skill-file/${app.app_name}/README.md`).catch(() => ({ data: { content: null } })),
          gwService.getSkillsStatus().catch(() => []),
        ]);
        setSkillContent(skillRes.data.content);
        setReadmeContent(readmeRes.data.content);
        // Find this skill in the status list
        const bareId = app.app_name.replace(/^claw-/, '');
        const found = allStatuses.find(s => s.name === app.app_name || s.name === bareId || s.skill_key === app.app_name || s.skill_key === bareId);
        setSkillStatus(found ?? null);
      } catch { /* silent */ }
    };
    loadFiles();
  }, [app.app_name]);

  // Fetch agents and which ones have this skill
  useEffect(() => {
    api.get<{ data: Array<{ id: string; name: string; display_name: string; avatar: string | null; skills: Array<{ id: string; name: string }> }> }>('/managed-agents')
      .then(res => {
        setAllAgents(res.data);
        const assigned = res.data.filter(a =>
          a.skills.some(s => s.id === app.app_name || s.name === app.app_name || s.id === `claw-${app.app_name}`)
        );
        setAssignedAgents(assigned);
      })
      .catch(() => {});
  }, [app.app_name]);

  // Fetch skill config (for OpenClaw bundled skills)
  useEffect(() => {
    if (app.source === 'openclaw') {
      gwService.getSkillsConfig()
        .then(config => {
          const entries = (config.entries ?? {}) as Record<string, Record<string, unknown>>;
          const entry = entries[app.app_name] ?? entries[app.app_name.replace('claw-', '')] ?? {};
          setConfigEnabled(entry.enabled !== false);
          setConfigApiKey((entry.api_key ?? '') as string);
          const env = (entry.env ?? {}) as Record<string, string>;
          setConfigEnv(env);
        })
        .catch(() => {});
    }
  }, [app.app_name, app.source]);

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      if (app.source === 'openclaw') {
        await gwService.updateSkillsConfig({
          entries: { [app.app_name]: { enabled: configEnabled, ...(configApiKey ? { apiKey: configApiKey } : {}), ...(Object.keys(configEnv).length > 0 ? { env: configEnv } : {}) } },
        });
      }
      toast.success('Config saved');
      setConfigDirty(false);
    } catch { toast.error('Failed to save config'); }
    finally { setConfigSaving(false); }
  };

  const handleAssignAgent = async (agentId: string) => {
    const agent = allAgents.find(a => a.id === agentId);
    if (!agent) return;
    const currentSkills = agent.skills.map(s => s.id);
    if (currentSkills.includes(app.app_name)) return;
    try {
      await api.patch(`/managed-agents/${agentId}/skills`, { skills: [...currentSkills, app.app_name] });
      toast.success(`Assigned to ${agent.display_name}`);
      // Refresh agents
      const res = await api.get<{ data: typeof allAgents }>('/managed-agents');
      setAllAgents(res.data);
      setAssignedAgents(res.data.filter(a => a.skills.some(s => s.id === app.app_name)));
    } catch { toast.error('Failed to assign'); }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanApp(app.app_name);
      setScanResult(result);
      setActiveTab('scan');
    } catch {
      toast.error('Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportApp(app.app_name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.app_name}-${app.version}.claw`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = app.status === 'active' ? 'disabled' : 'active';
    try {
      await updateAppStatus(app.app_name, newStatus);
      if (app.app_level === 1) {
        setRestartRequired('openclaw', `${app.app_name} was ${newStatus}`);
      }
      onRefresh();
      toast.success(`App ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleUninstall = async () => {
    try {
      const result = await uninstallApp(app.app_name);
      if (result.requires_restart) {
        setRestartRequired(
          app.app_level === 1 ? 'openclaw' : 'core',
          `${app.app_name} was uninstalled`,
        );
      }
      toast.success('App archived');
      onBack();
      onRefresh();
    } catch {
      toast.error('Failed to uninstall');
    }
    setDeleteDialog(false);
  };

  const handlePurge = async () => {
    try {
      await uninstallApp(app.app_name, true);
      toast.success('App permanently deleted');
      onBack();
      onRefresh();
    } catch {
      toast.error('Failed to purge');
    }
    setPurgeDialog(false);
  };

  const [forkDialogOpen, setForkDialogOpen] = useState(false);
  const [forkSuggestedName, setForkSuggestedName] = useState('');

  const handleFork = async () => {
    try {
      const suggested = await suggestForkName(app.app_name);
      setForkSuggestedName(suggested);
      setForkDialogOpen(true);
    } catch {
      toast.error('Failed to prepare fork');
    }
  };

  const handleForkConfirm = async (newName: string) => {
    try {
      await forkApp(app.app_name, newName);
      toast.success(`Forked as ${newName}`);
      onRefresh();
    } catch {
      toast.error('Failed to fork app');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteApp(app.app_name);
      toast.success('App deleted');
      onBack();
      onRefresh();
    } catch {
      toast.error('Failed to delete');
    }
    setDeleteDialog(false);
  };

  const isPreinstalled = ['local', 'micelhub', 'openclaw'].includes(app.source);

  const levelStyle = LEVEL_STYLES[String(app.app_level)] ?? LEVEL_STYLES['1'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-sans)', minWidth: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 2, display: 'flex',
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 18 }}>{manifest?.ui?.module?.icon || '📦'}</span>
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

        {/* Meta */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {manifest?.author && <span>Author: {manifest.author}</span>}
          <span>·</span>
          <span>v{app.version}</span>
          {manifest?.tier_required === 'pro' && (
            <>
              <span>·</span>
              <Badge className="text-[10px] px-1.5 py-0">Pro</Badge>
            </>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {manifest?.permissions?.slice(0, 6).map((perm) => (
            <Badge key={perm} variant="secondary" className="text-[10px] px-1.5 py-0">
              {perm}
            </Badge>
          ))}
          {app.source === 'adapted' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: '#14b8a6', color: '#14b8a6' }}>
              Adapted
            </Badge>
          )}
          {(app.source === 'micelhub' || app.source === 'local') && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: '#06b6d4', color: '#06b6d4' }}>
              <Shield size={8} style={{ marginRight: 2 }} /> Micelclaw
            </Badge>
          )}
          {app.source === 'openclaw' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: '#9f1239', color: '#9f1239' }}>
              OpenClaw
            </Badge>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {(['readme', 'skill', 'config', 'scan'] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === 'scan' && !scanResult) handleScan();
              else setActiveTab(t);
            }}
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
            {t === 'scan' && (scanning ? 'Scanning…' : 'Scan Results')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1 app-detail-scroll">
        <div className="app-detail-content">
          {activeTab === 'readme' && (
            <div className="app-detail-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                {readmeContent || manifest?.description || `# ${manifest?.name || app.app_name}\n\nNo README available.`}
              </ReactMarkdown>
            </div>
          )}

          {activeTab === 'skill' && (
            <div className="app-detail-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                {(skillContent?.replace(/^---\n[\s\S]*?\n---\s*/, '') ?? '_Loading SKILL.md..._').trim()}
              </ReactMarkdown>
            </div>
          )}

          {activeTab === 'scan' && scanResult && (
            <ScanResultsView result={scanResult} />
          )}

          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* OS not supported */}
              {(skillStatus?.missing?.os?.length ?? 0) > 0 && (
                <div style={{ padding: '12px 14px', background: '#ef444410', border: '1px solid #ef444425', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#ef4444', fontWeight: 500 }}>
                    This app is only available on {skillStatus?.requirements?.os?.join(', ') || 'other platforms'} and cannot be used on this system.
                  </span>
                </div>
              )}

              {/* Dependencies (binary requirements) */}
              {(skillStatus?.requirements?.bins?.length ?? 0) > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dependencies</h4>
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
                            const installId = skillStatus!.install[0].id;
                            toast('Installing ' + bin + '...', { duration: 300000 });
                            try {
                              const result = await gwService.installAppDeps(skillStatus!.name, installId);
                              if (result.ok) { toast.success(bin + ' installed!'); }
                              else { toast.error('Failed: ' + result.message); }
                            } catch { toast.error('Install failed'); }
                          }} style={{
                            padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 500,
                            background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-sm)',
                            color: '#000', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}>
                            Install ({skillStatus!.install[0].label || skillStatus!.install[0].kind})
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
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Settings</h4>
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
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Configuration</h4>
                  {skillStatus!.requirements.config.map(cfg => {
                    const isMissing = skillStatus!.missing.config.includes(cfg);
                    const channelMatch = cfg.match(/channels\.(\w+)/);
                    return (
                      <div key={cfg} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                        <span style={{ fontSize: '0.8125rem', color: isMissing ? 'var(--amber)' : '#22c55e' }}>{isMissing ? '⚠' : '✓'}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                          {channelMatch ? `Requires ${channelMatch[1].charAt(0).toUpperCase() + channelMatch[1].slice(1)} channel to be configured` : cfg}
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

              {/* Enable/disable toggle */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Enabled</span>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>When disabled, agents won't see this app</div>
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

              {/* Save */}
              {configDirty && (
                <button onClick={handleSaveConfig} disabled={configSaving} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600,
                  background: 'var(--amber)', border: 'none', borderRadius: 'var(--radius-sm)',
                  color: '#000', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  opacity: configSaving ? 0.7 : 1,
                }}>
                  <Save size={14} /> {configSaving ? 'Saving...' : 'Save'}
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
              Required Permissions
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
            <span>Status: <strong style={{ color: runtime.status === 'loaded' ? 'var(--success)' : 'var(--error)' }}>{runtime.status}</strong></span>
            <span>Routes: {runtime.routes_registered}</span>
            <span>Tables: {runtime.tables_created}</span>
            {runtime.containers_running !== undefined && <span>Containers: {runtime.containers_running}</span>}
          </div>
        )}
      </ScrollArea>

      {/* Actions footer */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 6, justifyContent: 'flex-end',
      }}>
        {isPreinstalled && (
          <FooterButton
            icon={<Copy size={13} />}
            label="Fork"
            onClick={handleFork}
            title="Create an editable copy of this app"
          />
        )}
        {app.source === 'adapted' && onEditFiles && (
          <FooterButton
            icon={<Code size={13} />}
            label="Edit Files"
            onClick={onEditFiles}
            title="Open file editor for this adapted app"
          />
        )}
        <FooterButton
          icon={<Power size={13} />}
          label={app.status === 'active' ? 'Disable' : 'Enable'}
          onClick={handleToggleStatus}
        />
        <FooterButton
          icon={<Download size={13} />}
          label="Export .claw"
          onClick={handleExport}
        />
        {app.source === 'adapted' ? (
          <FooterButton
            icon={<Trash2 size={13} />}
            label="Delete"
            onClick={() => setDeleteDialog(true)}
            danger
          />
        ) : (
          <FooterButton
            icon={<Trash2 size={13} />}
            label="Uninstall"
            onClick={() => setDeleteDialog(true)}
            danger
            disabled={isPreinstalled}
            title={isPreinstalled ? 'Preinstalled apps cannot be uninstalled' : undefined}
          />
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={app.source === 'adapted' ? handleDelete : handleUninstall}
        title={app.source === 'adapted' ? `Delete ${app.app_name}?` : `Uninstall ${app.app_name}?`}
        description={app.source === 'adapted'
          ? 'This will permanently delete the adapted app and all its files.'
          : 'The app will be archived. You can purge it permanently later.'}
        confirmLabel={app.source === 'adapted' ? 'Delete' : 'Uninstall'}
        variant="danger"
      />

      <ConfirmDialog
        open={purgeDialog}
        onClose={() => setPurgeDialog(false)}
        onConfirm={handlePurge}
        title={`Permanently delete ${app.app_name}?`}
        description="This will remove all data, schemas, and files. This cannot be undone."
        confirmLabel="Purge"
        variant="danger"
      />

      {forkDialogOpen && <ForkNameDialog
        suggestedName={forkSuggestedName}
        onConfirm={handleForkConfirm}
        onClose={() => setForkDialogOpen(false)}
      />}
    </div>
  );
}

// ─── Fork Name Dialog ───────────────────────────────────────────────

function ForkNameDialog({ suggestedName, onConfirm, onClose }: {
  suggestedName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(suggestedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
  }, []);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
      onClose();
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: 20, width: 360,
      }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
          Fork app — choose a name
        </label>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
          style={{
            width: '100%', padding: '8px 10px', fontSize: '0.875rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
            outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--amber)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            padding: '6px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>Cancel</button>
          <button onClick={handleConfirm} style={{
            padding: '6px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--amber)', border: 'none',
            color: '#000', fontSize: '0.8125rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>Fork</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function ScanResultsView({ result }: { result: ScanResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 'var(--radius-md)',
        background: result.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
        border: `1px solid ${result.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: result.passed ? 'var(--success)' : 'var(--error)' }}>
          {result.passed ? '✓ Scan passed' : '✕ Scan failed'}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
          Level: {result.level} · {new Date(result.scanned_at).toLocaleString()}
        </span>
      </div>

      {result.errors.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--error)', margin: '0 0 6px' }}>
            Errors ({result.errors.length})
          </h4>
          {result.errors.map((err, i) => (
            <div key={i} style={{
              padding: '6px 10px', marginBottom: 4,
              background: 'rgba(244, 63, 94, 0.05)',
              border: '1px solid rgba(244, 63, 94, 0.15)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
            }}>
              <span style={{ fontWeight: 500, color: 'var(--error)' }}>{err.code}</span>
              <span style={{ color: 'var(--text-dim)' }}> — {err.message}</span>
              {err.detail && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {err.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)', margin: '0 0 6px' }}>
            Warnings ({result.warnings.length})
          </h4>
          {result.warnings.map((warn, i) => (
            <div key={i} style={{
              padding: '6px 10px', marginBottom: 4,
              background: 'rgba(249, 115, 22, 0.05)',
              border: '1px solid rgba(249, 115, 22, 0.15)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
            }}>
              <span style={{ fontWeight: 500, color: 'var(--warning)' }}>{warn.code}</span>
              <span style={{ color: 'var(--text-dim)' }}> — {warn.message}</span>
              {warn.detail && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {warn.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result.errors.length === 0 && result.warnings.length === 0 && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', margin: 0 }}>
          No issues found.
        </p>
      )}
    </div>
  );
}

function FooterButton({ icon, label, onClick, danger, disabled, title }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '6px 12px',
        color: danger && !disabled ? 'var(--error)' : 'var(--text-dim)',
        fontSize: '0.8125rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'var(--font-sans)',
        transition: 'border-color var(--transition-fast)',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {icon}
      {label}
    </button>
  );
}
