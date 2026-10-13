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

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { pickPhrases } from './dreamPhrases';
import { PhaseChip, formatCountdown, cronToTime, dreamCard, dimText, dreamBtn } from './shared';
import type { DreamingConfig, DreamingStatus } from './types';
import './dreams.css';

const PHRASE_MS = 6_000;

interface Props {
  agentName: string;
  agentAvatar?: string;
  status: DreamingStatus | undefined;
  dreamCfg: DreamingConfig | null;
  togglingDream: boolean;
  onToggleDreaming: (next: boolean) => void;
  onSaveConfig: (patch: { frequency?: string; model?: string }) => Promise<boolean>;
  canManageGlobalMemory: boolean;
}

/** Posiciones deterministas de estrellas (pseudo-random seeded — sin Math.random en render). */
function starField(count: number): Array<{ left: number; top: number; size: number; delay: number }> {
  const stars = [];
  for (let i = 0; i < count; i++) {
    const a = Math.sin(i * 127.1) * 43758.5453;
    const b = Math.sin(i * 311.7) * 12543.867;
    stars.push({
      left: Math.abs(a % 1) * 96 + 2,
      top: Math.abs(b % 1) * 62 + 4,
      size: i % 3 === 0 ? 2.5 : 1.5,
      delay: (i % 8) * 0.45,
    });
  }
  return stars;
}

export function DreamScene({ agentName, agentAvatar, status, dreamCfg, togglingDream, onToggleDreaming, onSaveConfig, canManageGlobalMemory }: Props) {
  const isMobile = useIsMobile();
  const s = status ?? {};
  const dreamingOn = (dreamCfg?.enabled ?? s.enabled ?? false) === true;
  const memoryCoreOff = dreamCfg ? dreamCfg.memory_core_enabled === false : false;
  const active = dreamingOn && !memoryCoreOff;

  // Frase rotatoria (gateada por visibilidad de la pestaña)
  const phrases = useMemo(() => pickPhrases(s), [s]);
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setPhraseIdx(i => (i + 1) % Math.max(phrases.length, 1));
    }, PHRASE_MS);
    return () => clearInterval(iv);
  }, [active, phrases.length]);

  // Countdown local (ticker 30s, sin refetch)
  const nextRunMs = useMemo(() => {
    const candidates = [s.phases?.light?.next_run_at_ms, s.phases?.deep?.next_run_at_ms, s.phases?.rem?.next_run_at_ms]
      .filter((v): v is number => typeof v === 'number' && v > Date.now());
    return candidates.length ? Math.min(...candidates) : undefined;
  }, [s.phases]);
  const [, forceTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => forceTick(t => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
  const countdown = formatCountdown(nextRunMs);
  const sweepTime = cronToTime(dreamCfg?.frequency ?? s.phases?.deep?.cron);

  // Ajustes del sueño
  const [showSettings, setShowSettings] = useState(false);
  const [freqDraft, setFreqDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setFreqDraft(dreamCfg?.frequency ?? '0 3 * * *');
    setModelDraft(dreamCfg?.model ?? '');
  }, [dreamCfg?.frequency, dreamCfg?.model]);

  const saveSettings = async () => {
    setSaving(true);
    const ok = await onSaveConfig({ frequency: freqDraft.trim(), model: modelDraft.trim() });
    setSaving(false);
    if (ok) setShowSettings(false);
  };
  const presetHour = (h: number) => setFreqDraft(`0 ${h} * * *`);

  const stars = useMemo(() => starField(isMobile ? 12 : 24), [isMobile]);
  const sceneHeight = isMobile ? 190 : 250;
  const avatar = agentAvatar || '🤖';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Escena */}
      <div style={{ ...dreamCard, padding: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'relative', height: sceneHeight, overflow: 'hidden',
          background: active
            ? 'linear-gradient(180deg, #0b1030 0%, #070a1c 55%, #050509 100%)'
            : 'linear-gradient(180deg, #1c2547 0%, #141a35 55%, #0b0f22 100%)',
        }}>
          {/* Estrellas (solo de noche) */}
          {active && stars.map((st, i) => (
            <span key={i} className="drm-star" style={{
              position: 'absolute', left: `${st.left}%`, top: `${st.top}%`,
              width: st.size, height: st.size, borderRadius: '50%',
              background: '#e8e6d8', animationDelay: `${st.delay}s`,
            }} />
          ))}

          {/* Luna / Sol */}
          {active ? (
            <svg className="drm-moon" width={isMobile ? 40 : 54} height={isMobile ? 40 : 54} viewBox="0 0 54 54"
              style={{ position: 'absolute', top: 18, right: 24 }}>
              <path d="M 38 6 A 22 22 0 1 0 48 34 A 17 17 0 0 1 38 6 Z" fill="#efe9c8" />
            </svg>
          ) : (
            <svg className="drm-sun" width={isMobile ? 42 : 56} height={isMobile ? 42 : 56} viewBox="0 0 56 56"
              style={{ position: 'absolute', top: 16, right: 24 }}>
              <circle cx="28" cy="28" r="13" fill="#f5c542" />
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4;
                return <line key={i} x1={28 + Math.cos(a) * 18} y1={28 + Math.sin(a) * 18} x2={28 + Math.cos(a) * 24} y2={28 + Math.sin(a) * 24} stroke="#f5c542" strokeWidth="2.5" strokeLinecap="round" />;
              })}
            </svg>
          )}

          {/* Burbuja de pensamiento (solo dormido) */}
          {active && (
            <div style={{ position: 'absolute', left: '50%', top: isMobile ? 22 : 34, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '86%' }}>
              <div style={{
                padding: '8px 16px', borderRadius: 16, border: '1px solid rgba(232,230,216,0.25)',
                background: 'rgba(16, 20, 48, 0.75)', backdropFilter: 'blur(4px)',
              }}>
                <span key={phraseIdx} className="drm-bubble-text" style={{ display: 'block', fontSize: isMobile ? '0.72rem' : '0.8rem', fontStyle: 'italic', color: '#cfd3f0', textAlign: 'center' }}>
                  «{phrases[phraseIdx % Math.max(phrases.length, 1)]}»
                </span>
              </div>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(16,20,48,0.75)', border: '1px solid rgba(232,230,216,0.2)', marginTop: 5, marginLeft: -28 }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(16,20,48,0.75)', border: '1px solid rgba(232,230,216,0.2)', marginTop: 3, marginLeft: -44 }} />
            </div>
          )}

          {/* Z's */}
          {active && [0, 1, 2].map(i => (
            <span key={i} className="drm-z" style={{
              position: 'absolute', left: `calc(50% + ${26 + i * 10}px)`, bottom: isMobile ? 66 : 86,
              fontSize: 14 + i * 3, color: '#8f96c9', fontWeight: 700, animationDelay: `${i * 1.3}s`, fontStyle: 'italic',
            }}>z</span>
          ))}

          {/* Avatar dormido/despierto + montículo */}
          <div style={{ position: 'absolute', left: '50%', bottom: isMobile ? 18 : 26, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className={active ? 'drm-sleeper' : undefined} style={{
              width: isMobile ? 52 : 64, height: isMobile ? 52 : 64, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #2a3158, #171c38)',
              border: '1px solid rgba(232,230,216,0.18)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: isMobile ? 26 : 32, position: 'relative',
              filter: active ? 'saturate(0.8)' : 'none',
            }}>
              <span style={{ filter: active ? 'grayscale(0.15)' : 'none' }}>{avatar}</span>
              {active && (
                /* párpados: dos arcos que "cierran" los ojos del emoji */
                <svg width="100%" height="100%" viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
                  <path d="M 20 30 Q 24 34 28 30" stroke="#0c102a" strokeWidth="3" fill="none" strokeLinecap="round" />
                  <path d="M 36 30 Q 40 34 44 30" stroke="#0c102a" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div style={{ width: isMobile ? 110 : 140, height: isMobile ? 16 : 20, borderRadius: '50%', background: 'rgba(10, 13, 34, 0.9)', marginTop: -10, border: '1px solid rgba(232,230,216,0.08)' }} />
          </div>
        </div>

        {/* Línea de estado + fases */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px 14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: '0.74rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, letterSpacing: '0.05em',
              color: active ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.68rem',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? 'var(--success)' : 'var(--text-muted)' }} />
              {active ? 'SUEÑO ACTIVO' : dreamingOn ? 'SUEÑO CONFIGURADO' : 'DESPIERTO'}
            </span>
            {memoryCoreOff && dreamingOn && <span style={{ color: 'var(--warning)', fontSize: '0.7rem' }}>⚠ el plugin memory-core está desactivado</span>}
            {active && (
              <span style={dimText}>
                {s.promoted_today ?? 0} promovidos hoy
                {countdown && <> · próximo barrido {countdown}{sweepTime ? ` (${sweepTime}${s.timezone ? ` ${s.timezone}` : ''})` : ''}</>}
              </span>
            )}
            {!dreamingOn && (
              <span style={dimText}>
                {agentName} está despierto. Activa el sueño para que consolide su memoria cada noche.
              </span>
            )}
            <button onClick={() => setShowSettings(v => !v)} title="Ajustes globales del sueño" style={{ ...dreamBtn(), marginLeft: 'auto', padding: '4px 8px' }}>
              <Settings2 size={13} /> {canManageGlobalMemory ? 'Ajustes' : 'Ver ajustes'}
            </button>
            {!dreamingOn && canManageGlobalMemory && (
              <button onClick={() => onToggleDreaming(true)} disabled={togglingDream} style={{ ...dreamBtn('var(--success)') }}>
                {togglingDream ? <Loader2 size={13} className="animate-spin" /> : null} Activar sueño
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <PhaseChip name="light" phase={s.phases?.light} />
            <PhaseChip name="deep" phase={s.phases?.deep} />
            <PhaseChip name="rem" phase={s.phases?.rem} />
          </div>
        </div>
      </div>

      {/* Ajustes del sueño (global) */}
      {showSettings && (
        <div style={dreamCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Ajustes del sueño</span>
            <span style={{ ...dimText, fontSize: '0.65rem' }}>global — afecta a todos los agentes</span>
            {!canManageGlobalMemory && <span style={{ ...dimText, marginLeft: 'auto', fontSize: '0.65rem' }}>Solo owner/admin puede modificarlo</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ ...dimText, marginBottom: 4 }}>Hora del barrido nocturno</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {[3, 4, 5].map(h => (
                  <button key={h} onClick={() => presetHour(h)} disabled={!canManageGlobalMemory}
                    style={{ ...dreamBtn(freqDraft === `0 ${h} * * *` ? 'var(--amber)' : undefined) }}>
                    {String(h).padStart(2, '0')}:00
                  </button>
                ))}
                <input value={freqDraft} onChange={e => setFreqDraft(e.target.value)} disabled={!canManageGlobalMemory} placeholder="0 3 * * *" spellCheck={false}
                  style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono, monospace)', padding: '5px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', width: 110 }} />
                <span style={{ ...dimText, fontSize: '0.65rem' }}>cron de 5 campos</span>
              </div>
            </div>
            <div>
              <div style={{ ...dimText, marginBottom: 4 }}>Modelo de la narrativa del diario (vacío = el default del gateway)</div>
              <input value={modelDraft} onChange={e => setModelDraft(e.target.value)} disabled={!canManageGlobalMemory} placeholder="p.ej. google/gemini-2.5-flash" spellCheck={false}
                style={{ fontSize: '0.74rem', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', width: '100%', maxWidth: 340 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {canManageGlobalMemory && <button onClick={() => void saveSettings()} disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--amber)', color: '#1a1205', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : null} Guardar
              </button>}
              <button onClick={() => setShowSettings(false)} style={dreamBtn()}>{canManageGlobalMemory ? 'Cancelar' : 'Cerrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
