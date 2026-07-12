/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see repo LICENSE.
 */

// ─── StaticPublishPanel — publish a static target to a subdomain ─────
// Shared by the design canvas AND the Packaging phase (website / webapp /
// mobile). Fetches the user's system domains + any existing published
// site, lets them pick a subdomain, and publish / update / unpublish.
// The backend (`site-publisher.service`) already accepts design + the
// three static targets; this is the missing dash surface (B6).

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  listUserDomains, getProjectSite, publishProjectSite, unpublishSite,
  type SystemDomainOption, type PublishedSiteInfo,
} from '../design/design.service';

interface Props {
  projectId: string;
  projectName: string;
  /** installable = a PWA/mobile target — tweak the copy to say "installable". */
  installable?: boolean;
  onClose: () => void;
}

export function StaticPublishPanel({ projectId, projectName, installable, onClose }: Props) {
  const [domains, setDomains] = useState<SystemDomainOption[]>([]);
  const [site, setSite] = useState<PublishedSiteInfo | null>(null);
  const [slug, setSlug] = useState('');
  const [domainId, setDomainId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [doms, existing] = await Promise.all([listUserDomains(), getProjectSite(projectId)]);
        if (cancelled) return;
        setDomains(doms);
        if (doms[0]) setDomainId(doms[0].id);
        if (existing) { setSite(existing); setSlug(existing.host.split('.')[0] ?? ''); }
        else setSlug(projectName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'my-site');
      } catch { /* domains/site fetch best-effort */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [projectId, projectName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !publishing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [publishing, onClose]);

  async function handlePublish() {
    if (!domainId || !slug.trim() || publishing) return;
    setPublishing(true);
    try {
      const res = await publishProjectSite(projectId, { system_domain_id: domainId, subdomain: slug.trim(), spa_fallback: true });
      setSite({ id: res.id, host: res.host, status: 'published', current_release: res.release });
      toast.success(`Published at ${res.host}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally { setPublishing(false); }
  }

  async function handleUnpublish() {
    if (!site) return;
    try { await unpublishSite(site.id); setSite(null); toast.success('Taken offline'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Unpublish failed'); }
  }

  return (
    <div style={overlay} onClick={() => !publishing && onClose()}>
      <div onClick={(e) => e.stopPropagation()} style={dialog}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{installable ? 'Publish (installable)' : 'Publish as a website'}</strong>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }} aria-label="Close"><X size={15} /></button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 0', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
            <Loader2 size={14} className="spin" /> Loading…
          </div>
        ) : (
          <>
            {site && (
              <div style={liveBanner}>
                Live at <a href={`https://${site.host}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>https://{site.host}</a> (release {site.current_release}).
                {installable && ' Open it on your phone and "Add to home screen" to install.'} Publishing again updates it in place.
              </div>
            )}
            {domains.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                You don't have a system domain yet. Add one in Settings › Domains first — then any name
                under it (like <code>my-site.victor.claw</code>) can serve this.
              </p>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 500 }}>Address</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                  <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="my-site"
                    style={{ flex: 1, height: 36, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', padding: '0 10px', fontFamily: 'var(--font-sans)' }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>.</span>
                  <select value={domainId} onChange={(e) => setDomainId(e.target.value)}
                    style={{ height: 36, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', padding: '0 8px', maxWidth: 180 }}>
                    {domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {site && (
                    <button onClick={() => { void handleUnpublish(); }} style={{ ...btn, color: 'var(--danger)', borderColor: 'var(--danger)', background: 'transparent' }}>Unpublish</button>
                  )}
                  <button onClick={() => { void handlePublish(); }} disabled={!slug.trim() || !domainId || publishing} style={primaryBtn(!slug.trim() || !domainId || publishing)}>
                    {publishing ? <><Loader2 size={13} className="spin" /> Publishing…</> : <>{site ? 'Publish update' : 'Publish'}</>}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' };
const dialog: React.CSSProperties = { width: 440, maxWidth: '92vw', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 };
const liveBanner: React.CSSProperties = { padding: '8px 10px', marginBottom: 12, borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, #22c55e 10%, transparent)', border: '1px solid #22c55e', fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5 };
const btn: React.CSSProperties = { padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const primaryBtn = (disabled: boolean): React.CSSProperties => ({ ...btn, background: 'var(--amber)', color: '#000', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'default' : 'pointer' });
