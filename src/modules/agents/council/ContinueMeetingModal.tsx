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

import { useState, type ReactNode } from 'react';
import { Loader2, MessagesSquare, HelpCircle } from 'lucide-react';
import type { Meeting } from '../types';

interface ContinueMeetingModalProps {
  meeting: Meeting;
  onClose: () => void;
  onContinue: (opts: { mode: 'debate' | 'qa'; directive: string; rounds?: number; participate?: boolean }) => Promise<boolean>;
}

// Atajos de enfoque para el modo debate: rellenan el textarea de un clic.
const FOCUS_PRESETS: { label: string; text: string }[] = [
  { label: 'Más detalle', text: 'Profundizad y dad más detalle sobre lo ya hablado.' },
  { label: 'Cuestiona las conclusiones', text: 'Haced de abogado del diablo: cuestionad las conclusiones y buscad qué falla.' },
  { label: 'Explora alternativas', text: 'Explorad alternativas distintas a lo que habéis propuesto.' },
  { label: 'Concreta las tareas', text: 'Concretad las tareas: hacedlas más accionables, con pasos y criterio de "hecho".' },
  { label: 'Añade un ángulo nuevo', text: 'Añadid un ángulo que no se haya tratado todavía.' },
];

export function ContinueMeetingModal({ meeting, onClose, onContinue }: ContinueMeetingModalProps) {
  const [mode, setMode] = useState<'debate' | 'qa'>('debate');
  const [directive, setDirective] = useState('');
  const [rounds, setRounds] = useState(2);
  const [participate, setParticipate] = useState(meeting.user_participates ?? false);
  const [busy, setBusy] = useState(false);

  const canSubmit = directive.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    const ok = await onContinue({
      mode,
      directive: directive.trim(),
      ...(mode === 'debate' ? { rounds, participate } : {}),
    });
    setBusy(false);
    if (ok) onClose();
  };

  const modeBtn = (m: 'debate' | 'qa', icon: ReactNode, label: string) => (
    <button
      onClick={() => setMode(m)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '9px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
        border: `1px solid ${mode === m ? 'var(--amber)' : 'var(--border)'}`,
        background: mode === m ? 'rgba(245,166,35,0.10)' : 'transparent',
        color: mode === m ? 'var(--amber)' : 'var(--text-dim)',
      }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24,
          maxWidth: 520, width: '92vw', fontFamily: 'var(--font-sans)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
          Continuar &ldquo;{meeting.title}&rdquo;
        </h3>
        <p style={{ margin: '6px 0 16px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Los agentes retoman el debate con todo el contexto anterior. No se pierde nada de lo ya hablado.
        </p>

        {/* Selector de modo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {modeBtn('debate', <MessagesSquare size={14} />, 'Continuar el debate')}
          {modeBtn('qa', <HelpCircle size={14} />, 'Preguntar al council')}
        </div>

        {/* Enfoque / pregunta */}
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600 }}>
          {mode === 'debate' ? 'Enfoque de la continuación' : 'Tu pregunta al council'}
        </label>
        <textarea
          value={directive}
          onChange={e => setDirective(e.target.value)}
          placeholder={mode === 'debate'
            ? 'p.ej. Profundizad en la conciliación bancaria con n8n…'
            : 'p.ej. ¿Qué riesgos tiene depender de n8n para esto?'}
          rows={3}
          style={{
            width: '100%', resize: 'vertical', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            padding: '9px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box',
          }}
        />

        {/* Chips de preset (solo debate) */}
        {mode === 'debate' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {FOCUS_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setDirective(p.text)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.6875rem',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-dim)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Rondas + participar (solo debate) */}
        {mode === 'debate' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)' }}>
              Rondas adicionales
              <select
                value={rounds}
                onChange={e => setRounds(Number(e.target.value))}
                style={{
                  padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                }}
              >
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={participate}
                onChange={e => setParticipate(e.target.checked)}
                style={{ accentColor: 'var(--amber)' }}
              />
              Participar en esta continuación
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', cursor: busy ? 'not-allowed' : 'pointer',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', cursor: canSubmit ? 'pointer' : 'not-allowed',
              border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              background: canSubmit ? 'var(--amber)' : 'var(--border)',
              color: canSubmit ? '#1a1205' : 'var(--text-dim)',
            }}
          >
            {busy && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {mode === 'debate' ? 'Continuar' : 'Preguntar'}
          </button>
        </div>
      </div>
    </div>
  );
}
