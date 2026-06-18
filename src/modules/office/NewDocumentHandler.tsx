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

// ─── New Document handler ────────────────────────────────────────────
// Ruta `/office/new?type=docx|xlsx|pptx`. A esta llegan los atajos
// docs/sheets/presentations.victor.claw (redirect de Caddy). Crea un
// documento EN BLANCO nuevo (createNewDocument, ya existente) y navega al
// editor. Cada visita = uno nuevo (modelo Google Docs), con nombre único
// para no colisionar en Drive/Documents.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useOfficeStore } from '@/stores/office.store';

type DocType = 'docx' | 'xlsx' | 'pptx';
const TYPE_LABEL: Record<DocType, string> = {
  docx: 'documento',
  xlsx: 'hoja de cálculo',
  pptx: 'presentación',
};

function uniqueName(type: DocType): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  return `Sin título ${stamp}.${type}`;
}

export function Component() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const type = params.get('type') as DocType | null;
  const ran = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!type || !['docx', 'xlsx', 'pptx'].includes(type)) {
      navigate('/office', { replace: true });
      return;
    }
    useOfficeStore.getState().createNewDocument(type, uniqueName(type))
      .then((session) => navigate(`/office/edit/${session.fileId}`, { replace: true }))
      .catch((e: any) => {
        setError(e?.message ?? 'No se pudo crear el documento.');
        toast.error('No se pudo crear el documento');
      });
  }, [type, navigate]);

  const label = type && TYPE_LABEL[type] ? TYPE_LABEL[type] : 'documento';

  return (
    <div style={{
      height: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text)',
    }}>
      {error ? (
        <>
          <AlertTriangle size={36} style={{ color: 'var(--error)' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No se pudo crear el {label}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{error}</div>
          <button
            onClick={() => navigate('/office', { replace: true })}
            style={{
              marginTop: 4, padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--amber)', color: '#06060a', fontWeight: 600, cursor: 'pointer',
            }}
          >Ir a Office</button>
        </>
      ) : (
        <>
          <Loader2 size={34} className="animate-spin" style={{ color: 'var(--amber)' }} />
          <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Creando {label} en blanco…</div>
        </>
      )}
    </div>
  );
}
