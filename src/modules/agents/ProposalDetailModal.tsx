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
import { GraduationCap, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { api } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { SkillProposal, SkillProposalDetail } from './types';

interface ProposalDetailModalProps {
  proposal: SkillProposal | null;
  /** id del managed-agent destino (para los POST approve/reject). */
  agentId: string;
  open: boolean;
  onClose: () => void;
  /** Se llama tras aprobar/rechazar para que el padre refresque la cola y el agente. */
  onChanged: () => void;
}

const SCAN_BADGE: Record<string, { label: string; color: string; Icon: typeof ShieldCheck }> = {
  passed: { label: 'Escaneo de seguridad OK', color: 'var(--green, #10b981)', Icon: ShieldCheck },
  clean: { label: 'Escaneo de seguridad OK', color: 'var(--green, #10b981)', Icon: ShieldCheck },
  failed: { label: 'Escaneo marcó riesgos', color: 'var(--red, #ef4444)', Icon: ShieldAlert },
  flagged: { label: 'Escaneo marcó riesgos', color: 'var(--red, #ef4444)', Icon: ShieldAlert },
};

export function ProposalDetailModal({ proposal, agentId, open, onClose, onChanged }: ProposalDetailModalProps) {
  const [detail, setDetail] = useState<SkillProposalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    if (!open || !proposal) return;
    setDetail(null);
    setLoading(true);
    api.get<{ data: SkillProposalDetail }>(`/managed-agents/proposals/${encodeURIComponent(proposal.id)}`)
      .then((res) => setDetail(res.data))
      .catch(() => toast.error('No se pudo cargar la propuesta'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal?.id]);

  if (!proposal) return null;

  const approve = async () => {
    setBusy('approve');
    try {
      await api.post(`/managed-agents/${agentId}/proposals/${encodeURIComponent(proposal.id)}/approve`);
      toast.success(`Skill "${proposal.skill_name}" graduada — recarga el Gateway para que el agente la cargue`);
      onChanged();
      onClose();
    } catch {
      toast.error('No se pudo graduar la skill');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy('reject');
    try {
      await api.post(`/managed-agents/${agentId}/proposals/${encodeURIComponent(proposal.id)}/reject`);
      toast.success('Propuesta rechazada');
      onChanged();
      onClose();
    } catch {
      toast.error('No se pudo rechazar la propuesta');
    } finally {
      setBusy(null);
    }
  };

  const scanState = detail?.scan_state ?? proposal.scan_state ?? 'pending';
  const scan = SCAN_BADGE[scanState] ?? { label: 'Escaneo pendiente', color: 'var(--text-dim)', Icon: ShieldQuestion };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent style={{ maxWidth: 720, width: '92vw' }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap size={18} style={{ color: 'var(--amber)' }} />
            {proposal.title || proposal.skill_name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, rgba(127,127,127,0.12))', color: 'var(--text-dim)' }}>
            skill: {proposal.skill_name}
          </span>
          <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, rgba(127,127,127,0.12))', color: 'var(--text-dim)' }}>
            propuesta por {proposal.agent_name}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: scan.color }}>
            <scan.Icon size={13} /> {scan.label}
          </span>
        </div>

        {proposal.description && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', margin: '0 0 8px' }}>{proposal.description}</p>
        )}

        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          SKILL.md a graduar
        </div>
        <div style={{
          maxHeight: '46vh', overflow: 'auto', border: '1px solid var(--border, rgba(127,127,127,0.2))',
          borderRadius: 8, padding: 12, background: 'var(--bg-code, rgba(127,127,127,0.06))',
          fontSize: '0.8125rem', lineHeight: 1.5,
        }}>
          {loading ? (
            <span style={{ color: 'var(--text-dim)' }}>Cargando…</span>
          ) : detail?.draft ? (
            <div className="prose-skill"><ReactMarkdown>{detail.draft}</ReactMarkdown></div>
          ) : (
            <span style={{ color: 'var(--text-dim)' }}>Sin contenido de draft.</span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button
            onClick={reject}
            disabled={busy !== null}
            style={{
              padding: '7px 14px', borderRadius: 7, fontSize: '0.8125rem', cursor: busy ? 'default' : 'pointer',
              border: '1px solid var(--border, rgba(127,127,127,0.25))', background: 'transparent', color: 'var(--text-dim)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy === 'reject' ? 'Rechazando…' : 'Rechazar'}
          </button>
          <button
            onClick={approve}
            disabled={busy !== null}
            style={{
              padding: '7px 14px', borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer',
              border: 'none', background: 'var(--amber)', color: '#1a1205', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy === 'approve' ? 'Graduando…' : 'Aprobar y graduar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
