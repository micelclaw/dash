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

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Database, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';

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
      const res = await api.get<{ data: { mathesar: { running: boolean } } }>('/office/status');
      if (res.data.mathesar.running) { setPhase('ready'); await loadList(); return; }

      setPhase('starting');
      await api.post('/office/start/mathesar');
      let resolved = false;
      const poll = setInterval(async () => {
        try {
          const r2 = await api.get<{ data: { mathesar: { running: boolean } } }>('/office/status');
          if (r2.data.mathesar.running) {
            resolved = true; clearInterval(poll); setPhase('ready'); await loadList();
          }
        } catch { /* keep polling */ }
      }, 2500);
      setTimeout(() => {
        clearInterval(poll);
        if (!resolved) { setError('Mathesar no arrancó a tiempo'); setPhase('error'); }
      }, 150_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las bases de datos');
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
      <Plus size={14} /> Nueva base de datos
    </button>
  );

  // Estado de carga inicial SIN caché → spinner; con caché pintamos la rejilla igualmente.
  if (databases.length === 0 && (phase === 'loading' || phase === 'starting')) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '60%', color: 'var(--text-dim)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: phase === 'starting' ? 'var(--amber)' : undefined }} />
        <span style={{ fontSize: 14 }}>{phase === 'starting' ? 'Iniciando Mathesar…' : 'Cargando bases de datos…'}</span>
        {phase === 'starting' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Puede tardar un momento la primera vez</span>}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (databases.length === 0 && phase === 'error') {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '60%', color: 'var(--text-dim)' }}>
        <AlertTriangle size={28} style={{ color: 'var(--error)' }} />
        <span style={{ fontSize: 14 }}>Error con las bases de datos</span>
        {error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>}
        <button onClick={ensureReadyAndLoad} style={{ ...cardBtnReset, padding: '6px 16px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13 }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      {newButton}
      {ordered.length === 0 ? (
        <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          No hay bases de datos todavía. Crea una con “Nueva base de datos”.
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 12 }}>Recientes</h3>
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
                    {d.table_count != null ? `${d.table_count} ${d.table_count === 1 ? 'tabla' : 'tablas'}` : 'Base de datos'}
                    {openedAt && ` · abierta ${new Date(openedAt).toLocaleDateString()}`}
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

const cardBtnReset: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer' };
