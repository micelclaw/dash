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
import { useNavigate } from 'react-router';
import { api } from '@/services/api';
import {
  AlertTriangle, RefreshCw, Loader2, Wand2,
  Clapperboard, Download, Film, Tv, Music, BookOpen,
  Search, ListPlus, Music2, Library, Headphones,
} from 'lucide-react';
import { MultimediaStatusCard } from './MultimediaStatusCard';
import { MultimediaSetupWizard } from './MultimediaSetupWizard';

interface MultimediaAppStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  url: string | null;
  ram_mb: number | null;
  uptime_seconds: number | null;
}

interface MultimediaSuiteStatus {
  media_dirs: { name: string; path: string; exists: boolean }[];
  apps: MultimediaAppStatus[];
}

const APP_META: Record<string, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; description: string; path: string }> = {
  jellyfin:       { icon: Clapperboard, color: '#a855f7', description: 'Media Server',             path: '/multimedia/jellyfin' },
  qbittorrent:    { icon: Download,     color: '#2196f3', description: 'Torrent Client',            path: '/multimedia/qbittorrent' },
  radarr:         { icon: Film,         color: '#ffc230', description: 'Movie Automation',           path: '/multimedia/radarr' },
  sonarr:         { icon: Tv,           color: '#35c5f4', description: 'TV Series Automation',       path: '/multimedia/sonarr' },
  lidarr:         { icon: Music,        color: '#1db954', description: 'Music Automation',           path: '/multimedia/lidarr' },
  readarr:        { icon: BookOpen,     color: '#8b5cf6', description: 'Book Automation',            path: '/multimedia/readarr' },
  jackett:        { icon: Search,       color: '#e74c3c', description: 'Indexer Proxy',              path: '/multimedia/jackett' },
  jellyseerr:     { icon: ListPlus,     color: '#a855f7', description: 'Media Requests',             path: '/multimedia/jellyseerr' },
  navidrome:      { icon: Music2,       color: '#0ea5e9', description: 'Music Server',               path: '/multimedia/navidrome' },
  calibreweb:     { icon: Library,      color: '#8b5cf6', description: 'eBook Library',              path: '/multimedia/calibreweb' },
  audiobookshelf: { icon: Headphones,   color: '#4ade80', description: 'Audiobook & Podcast Server', path: '/multimedia/audiobookshelf' },
};

const CONSUMER_APPS = ['jellyfin', 'navidrome', 'calibreweb', 'audiobookshelf'];
const PRODUCER_APPS = ['qbittorrent', 'radarr', 'sonarr', 'lidarr', 'readarr'];
const SUPPORT_APPS  = ['jackett', 'jellyseerr'];

export function Component() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<MultimediaSuiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: MultimediaSuiteStatus }>('/multimedia/status');
      setStatus(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch multimedia status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleAction = async (app: string, action: 'start' | 'stop') => {
    try {
      await api.post(`/multimedia/${app}/${action}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} ${app}`);
    }
  };

  const svc = (name: string) => status?.apps.find(a => a.name === name) ?? null;

  if (error && !status && !loading) {
    return (
      <div className="mm-center">
        <AlertTriangle size={28} style={{ color: 'var(--error)' }} />
        <span>{error}</span>
        <button className="mm-btn" onClick={refresh}>Retry</button>
      </div>
    );
  }

  const renderGroup = (title: string, apps: string[]) => (
    <div>
      <h3 className="mm-section-title">{title}</h3>
      <div className="mm-grid">
        {apps.map(name => {
          const meta = APP_META[name];
          return (
            <MultimediaStatusCard
              key={name}
              app={svc(name)}
              loading={!status}
              icon={meta.icon}
              color={meta.color}
              description={meta.description}
              onInstall={() => navigate(meta.path)}
              onStart={() => handleAction(name, 'start')}
              onStop={() => handleAction(name, 'stop')}
              onNavigate={() => navigate(meta.path)}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mm-page">
      <div className="mm-header">
        <h2>Multimedia Suite</h2>
        <button className="mm-btn-icon" onClick={refresh} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Setup Wizard CTA */}
      <button className="mm-wizard-btn" onClick={() => setShowWizard(true)}>
        <Wand2 size={18} />
        <div>
          <div className="mm-wizard-btn-title">Setup Wizard</div>
          <div className="mm-wizard-btn-desc">Install and auto-configure your media stack</div>
        </div>
      </button>

      {error && <div className="mm-error">{error}</div>}

      {renderGroup('Media Servers', CONSUMER_APPS)}
      {renderGroup('Downloads & Automation', PRODUCER_APPS)}
      {renderGroup('Indexers & Requests', SUPPORT_APPS)}

      {showWizard && (
        <MultimediaSetupWizard
          installedApps={status?.apps.filter(a => a.installed).map(a => a.name) ?? []}
          onClose={() => setShowWizard(false)}
          onDone={() => { setShowWizard(false); refresh(); }}
        />
      )}

      <style>{`
        .mm-page { padding: 24px; }
        .mm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .mm-header h2 { font-size: 18px; font-weight: 600; color: var(--text); margin: 0; }
        .mm-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-dim); }
        .mm-btn { padding: 6px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text); cursor: pointer; font-size: 13px; }
        .mm-btn:hover { background: var(--surface-hover); }
        .mm-btn-icon { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-dim); cursor: pointer; }
        .mm-btn-icon:hover { background: var(--surface-hover); color: var(--text); }
        .mm-wizard-btn { display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px 20px; margin-bottom: 20px; background: linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04)); border: 1px solid rgba(168,85,247,0.35); border-radius: var(--radius-lg); cursor: pointer; text-align: left; transition: all 0.15s ease; color: #c084fc; }
        .mm-wizard-btn:hover { background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.08)); border-color: rgba(168,85,247,0.5); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(168,85,247,0.15); }
        .mm-wizard-btn-title { font-size: 14px; font-weight: 600; color: #c084fc; }
        .mm-wizard-btn-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .mm-error { padding: 8px 12px; margin-bottom: 12px; background: rgba(239,68,68,.1); border: 1px solid var(--error); border-radius: var(--radius-md); color: var(--error); font-size: 13px; }
        .mm-section-title { font-size: 14px; font-weight: 600; color: var(--text); margin: 24px 0 12px; }
        .mm-section-title:first-of-type { margin-top: 0; }
        .mm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

        .mm-status-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .mm-status-card:hover { border-color: var(--border-hover); }
        .mm-card-header { display: flex; align-items: center; gap: 10px; }
        .mm-card-name { font-size: 13px; font-weight: 500; color: var(--text); }
        .mm-card-desc { font-size: 11px; color: var(--text-muted); }
        .mm-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .mm-card-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-dim); }
        .mm-card-actions { display: flex; gap: 6px; }
        .mm-card-actions .mm-btn { display: flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 11px; font-weight: 500; border-radius: var(--radius-sm); cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-dim); }
        .mm-card-actions .mm-btn:hover { background: var(--surface-hover); color: var(--text); }
        .mm-btn-install { border: none !important; color: #fff !important; font-weight: 500; }
        .mm-btn-install:hover { filter: brightness(1.1); }
        .mm-spin { animation: mm-spin 1s linear infinite; }
        @keyframes mm-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
