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

// ─── Databases Launcher View ─────────────────────────────────────────
// Rejilla nativa del dash (estilo la tab Documents) que lista TUS bases de datos de
// Mathesar como tarjetas. Al clicar una, navega a /office/databases?db=<id> → el iframe
// abre esa base (deep-link /db/<id>/). El "reciente" lo llevamos en localStorage (Mathesar
// no trackea timestamps); la lista se cachea para pintar al instante y se refresca de fondo.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Database, Plus, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { OfficeErrorState } from './OfficeErrorState';
import {useI18n} from '@/i18n';
import {formatDate} from '@/i18n/format';
import {useSettingsStore} from '@/stores/settings.store';

interface DbItem { id: number; name: string; table_count: number | null }
type Phase = 'loading' | 'starting' | 'ready' | 'error';

const PURPLE = '#a855f7';
const LIST_CACHE_KEY = 'claw-databases-list';
const RECENT_KEY = 'claw-databases-recent';

function readJson<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}

export function DatabasesLauncherView() {
  const {t,locale}=useI18n();const tRef=useRef(t);useEffect(()=>{tRef.current=t;},[t]);
  const general=useSettingsStore(s=>s.serverSettings?.general);
  const navigate = useNavigate();
  // Pinta al instante desde caché; se refresca cuando Mathesar esté listo.
  const [databases, setDatabases] = useState<DbItem[]>(() => readJson<DbItem[]>(LIST_CACHE_KEY, []));
  const [recent, setRecent] = useState<Record<string, string>>(() => readJson<Record<string, string>>(RECENT_KEY, {}));
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const res = await api.get<{ data: DbItem[] }>('/databases/list');
    setDatabases(res.data);
    try { localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(res.data)); } catch { /* quota */ }
  }, []);

  // Garantiza Mathesar corriendo (mismo patrón que DatabasesFrame) y luego carga la lista.
  const ensureReadyAndLoad = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: { running: boolean } }>('/databases/status');
      if (res.data.running) { await loadList(); setPhase('ready'); return; }

      setPhase('starting');
      await api.post('/services/mathesar/start');
      let resolved = false;
      const poll = setInterval(async () => {
        try {
          const r2 = await api.get<{ data: { running: boolean } }>('/databases/status');
          if (r2.data.running) {
            resolved = true; clearInterval(poll);
            try { await loadList(); setPhase('ready'); }
            catch (error) { setError(error instanceof Error?error.message:tRef.current('office.db.loadError'));setPhase('error'); }
          }
        } catch { /* keep polling */ }
      }, 2500);
      setTimeout(() => {
        clearInterval(poll);
        if (!resolved) { setError(tRef.current('office.external.dbTimeout')); setPhase('error'); }
      }, 150_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current('office.db.loadError'));
      setPhase('error');
    }
  }, [loadList]);

  useEffect(() => { ensureReadyAndLoad(); }, [ensureReadyAndLoad]);

  const openDb = useCallback((id: number) => {
    const next = { ...readJson<Record<string, string>>(RECENT_KEY, {}), [id]: new Date().toISOString() };
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota */ }
    navigate(`/office/databases?db=${id}`);
  }, [navigate]);

  // Orden: abiertas más recientemente primero; sin fecha al final; desempate por nombre.
  const ordered = [...databases].sort((a, b) => {
    const ra = recent[a.id], rb = recent[b.id];
    if (ra && rb) return rb.localeCompare(ra);
    if (ra) return -1;
    if (rb) return 1;
    return a.name.localeCompare(b.name);
  });

  const newButton = (
    <button
      onClick={() => navigate('/office/databases')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 20px', marginBottom: 20,
        background: PURPLE, color: '#fff',
        border: 'none', borderRadius: 'var(--radius-md)',
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
      }}
    >
      <Plus size={14} /> {t('office.db.new')}
    </button>
  );

  // Estado de carga inicial SIN caché → spinner; con caché pintamos la rejilla igualmente.
  if (databases.length === 0 && (phase === 'loading' || phase === 'starting')) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '60%', color: 'var(--text-dim)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: phase === 'starting' ? 'var(--amber)' : undefined }} />
        <span style={{ fontSize: 14 }}>{t(phase === 'starting' ? 'office.external.dbStart' : 'office.db.loading')}</span>
        {phase === 'starting' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('office.external.firstLaunch')}</span>}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (phase === 'error') return <OfficeErrorState title={t('office.external.dbError')} message={error??undefined} color={PURPLE} onRetry={()=>{void ensureReadyAndLoad();}} />;

  return (
    <div>
      {newButton}
      {ordered.length === 0 ? (
        <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('office.db.empty')}
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 12 }}>{t('office.launcher.recent')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {ordered.map((d) => {
              const openedAt = recent[d.id];
              return (
                <button
                  key={d.id}
                  onClick={() => openDb(d.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: 16, background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <Database size={24} style={{ color: PURPLE, marginBottom: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {d.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {d.table_count != null ? t(d.table_count === 1 ? 'office.db.oneTable' : 'office.db.manyTables',{count:d.table_count}) : t('office.db.database')}
                    {openedAt && ` · ${t('office.db.opened',{date:formatDate(new Date(openedAt),locale,general,general?.timezone)})}`}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

