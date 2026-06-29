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
import { GraduationCap, FolderOpen, Copy, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatRelativeTime } from './shared/format';
import type { LearnedSkill } from './types';

interface LearnedSkillDetail {
  name: string;
  title: string;
  icon: string;
  graduated_at: string | null;
  skill_md: string;
  saved_path: string;
}

interface Props {
  skill: LearnedSkill | null;
  agentId: string;
  open: boolean;
  onClose: () => void;
  /** refrescar el agente del padre tras olvidar. */
  onChanged: () => void;
}

const iconBtn = { display: 'inline-flex', alignItems: 'center', padding: 4, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' } as const;

/** Quita el bloque frontmatter YAML inicial (`---\n...\n---`) para mostrar solo el cuerpo legible. */
function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  const after = md.indexOf('\n', end + 1);
  return after === -1 ? '' : md.slice(after + 1).replace(/^\s+/, '');
}

export function LearnedSkillDetailModal({ skill, agentId, open, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<LearnedSkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open || !skill) return;
    setDetail(null);
    setConfirmDel(false);
    setLoading(true);
    api.get<{ data: LearnedSkillDetail }>(`/managed-agents/${agentId}/learned-skills/${encodeURIComponent(skill.name)}`)
      .then((r) => setDetail(r.data))
      .catch(() => toast.error('No se pudo cargar la skill aprendida'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skill?.name]);

  if (!skill) return null;

  const forget = async () => {
    setBusy(true);
    try {
      await api.delete(`/managed-agents/${agentId}/learned-skills/${encodeURIComponent(skill.name)}`);
      toast.success(`Skill "${skill.name}" olvidada — recarga el Gateway para que el agente deje de cargarla`);
      onChanged();
      onClose();
    } catch {
      toast.error('No se pudo olvidar la skill');
    } finally {
      setBusy(false);
    }
  };

  const openExplorer = () => {
    if (detail?.saved_path) window.open(`/explorer?path=${encodeURIComponent(detail.saved_path)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent style={{ maxWidth: 680, width: '92vw' }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>{skill.icon || '🎓'}</span>
            {skill.title || skill.name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, rgba(127,127,127,0.12))' }}>{skill.name}</span>
          {skill.graduated_at && <span>graduada {formatRelativeTime(skill.graduated_at)}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GraduationCap size={12} /> skill aprendida (no es una app)</span>
        </div>

        {/* Dónde está guardada */}
        {detail?.saved_path && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <code style={{ flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg-code, rgba(127,127,127,0.06))', padding: '4px 8px', borderRadius: 6 }}>
              {detail.saved_path}
            </code>
            <button onClick={() => { navigator.clipboard?.writeText(detail.saved_path); toast.success('Ruta copiada'); }} title="Copiar ruta" style={iconBtn}><Copy size={13} /></button>
            <button onClick={openExplorer} title="Abrir en File Explorer" style={iconBtn}><FolderOpen size={13} /></button>
          </div>
        )}

        {/* Contenido del SKILL.md */}
        <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '12px 0 4px' }}>
          SKILL.md
        </div>
        <div style={{ maxHeight: '46vh', overflow: 'auto', border: '1px solid var(--border, rgba(127,127,127,0.2))', borderRadius: 8, padding: 12, background: 'var(--bg-code, rgba(127,127,127,0.06))', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          {loading ? (
            <span style={{ color: 'var(--text-dim)' }}>Cargando…</span>
          ) : detail?.skill_md ? (
            <div className="prose-skill"><ReactMarkdown>{stripFrontmatter(detail.skill_md)}</ReactMarkdown></div>
          ) : (
            <span style={{ color: 'var(--text-dim)' }}>Sin contenido (no se encontró el SKILL.md).</span>
          )}
        </div>

        {/* Acción: olvidar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          {confirmDel ? (
            <>
              <button onClick={forget} disabled={busy} style={{ padding: '7px 14px', borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600, border: 'none', background: 'var(--red, #ef4444)', color: '#fff', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Olvidando…' : 'Olvidar definitivamente'}
              </button>
              <button onClick={() => setConfirmDel(false)} disabled={busy} style={{ padding: '7px 14px', borderRadius: 7, fontSize: '0.8125rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>Cancelar</button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, fontSize: '0.8125rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--red, #ef4444)', cursor: 'pointer' }}>
              <Trash2 size={13} /> Olvidar skill
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
