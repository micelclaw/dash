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

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { api } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AgentSkill } from './types';

interface SkillToolInfo { action: string; description: string; }
interface SkillDetail {
  name: string;
  emoji: string;
  description: string;
  domains: string[];
  tools: { core: SkillToolInfo[]; full_only: SkillToolInfo[] };
  skill_md: string;
}

interface AppDetailModalProps {
  skill: AgentSkill | null;
  agentId: string;
  /** Todos los skill ids actuales del agente (el PATCH reemplaza la lista). */
  allSkillIds: string[];
  skillModes: Record<string, 'core' | 'full'>;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function AppDetailModal({ skill, agentId, allSkillIds, skillModes, open, onClose, onChanged }: AppDetailModalProps) {
  const skillId = skill ? (skill.skill_id ?? `claw-${skill.domain}`) : '';
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'core' | 'full'>('full');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !skill) return;
    setMode(skillModes[skillId] ?? 'full');
    setDetail(null);
    setLoading(true);
    api.get<{ data: SkillDetail }>(`/managed-agents/skills/${encodeURIComponent(skillId)}/detail`)
      .then((res) => setDetail(res.data))
      .catch(() => toast.error('No se pudo cargar el detalle de la app'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skillId]);

  const changeMode = async (next: 'core' | 'full') => {
    if (next === mode || saving) return;
    const prev = mode;
    setMode(next);
    setSaving(true);
    try {
      await api.patch(`/managed-agents/${agentId}/skills`, {
        skills: allSkillIds,
        skill_modes: { ...skillModes, [skillId]: next },
      });
      toast.success(`${skill?.name}: modo ${next === 'core' ? 'núcleo' : 'completo'}`);
      onChanged();
    } catch {
      setMode(prev);
      toast.error('No se pudo cambiar el modo');
    } finally {
      setSaving(false);
    }
  };

  if (!skill) return null;
  const hasFull = (detail?.tools.full_only.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span style={{ fontSize: '1.25rem' }}>{skill.icon}</span>
            {skill.name}
          </DialogTitle>
        </DialogHeader>

        {/* Toggle Resumida / Completa */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['core', 'full'] as const).map((m) => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              disabled={saving}
              style={{
                flex: 1, padding: '6px 8px', fontSize: '0.75rem', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                background: mode === m ? 'var(--amber-dim)' : 'var(--surface)',
                border: `1px solid ${mode === m ? 'var(--amber)' : 'var(--border)'}`,
                color: mode === m ? 'var(--amber)' : 'var(--text-dim)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {m === 'core' ? 'Resumida (núcleo)' : 'Completa'}
            </button>
          ))}
        </div>
        {detail && !hasFull && (
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: 0 }}>
            Esta app no tiene funciones avanzadas: núcleo y completa son iguales.
          </p>
        )}

        {loading && <p style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>Cargando…</p>}

        {detail && (
          <>
            <ToolGroup title={`Núcleo (${detail.tools.core.length})`} tools={detail.tools.core} dim={false} />
            {hasFull && (
              <ToolGroup
                title={`Adicionales en Completa (+${detail.tools.full_only.length})`}
                tools={detail.tools.full_only}
                dim={mode === 'core'}
              />
            )}

            {detail.skill_md && (
              <div style={{ marginTop: 8 }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Guía</h4>
                <div className="prose prose-invert prose-sm max-w-none" style={{ fontSize: '0.75rem' }}>
                  <ReactMarkdown>{detail.skill_md}</ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ToolGroup({ title, tools, dim }: { title: string; tools: { action: string; description: string }[]; dim: boolean }) {
  if (tools.length === 0) return null;
  return (
    <div style={{ marginTop: 6, opacity: dim ? 0.45 : 1 }}>
      <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{title}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tools.map((t) => (
          <div key={t.action} style={{ fontSize: '0.6875rem', lineHeight: 1.35 }}>
            <code style={{ color: 'var(--amber)' }}>{t.action}</code>
            <span style={{ color: 'var(--text-dim)' }}> — {t.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
