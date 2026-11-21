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
import { Loader2 } from 'lucide-react';
import { getOfficeProviders, newOfficeDocument, preferredProvider } from './office-providers.service';
import {useI18n} from '@/i18n';
import { OfficeErrorState } from './OfficeErrorState';
import { officeColor } from '@/config/office-colors';

type DocType = 'docx' | 'xlsx' | 'pptx' | 'pdf';

export function Component() {
  const {t}=useI18n();const tRef=useRef(t);useEffect(()=>{tRef.current=t;},[t]);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const type = params.get('type') as DocType | null;
  const ran = useRef(false);
  const [error, setError] = useState('');
  const [attempt,setAttempt]=useState(0);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!type || !['docx', 'xlsx', 'pptx', 'pdf'].includes(type)) {
      navigate('/office', { replace: true });
      return;
    }
    const create = async () => {
      const status = await getOfficeProviders();
      const slot = ({ docx: 'documents', xlsx: 'spreadsheets', pptx: 'presentations', pdf: 'pdf' } as const)[type];
      const provider = preferredProvider(status.providers, slot);
      if (provider) return (await newOfficeDocument(provider.app_name)).editor_url;
      throw new Error(tRef.current('office.new.selectProvider'));
    };
    create()
      .then((path) => { const target = new URL(path, location.origin); target.searchParams.set('fullscreen', '1'); navigate(target.pathname + target.search, { replace: true }); })
      .catch((e: any) => {
        setError(e?.message ?? tRef.current('office.new.error'));
      });
  }, [type, navigate,attempt]);

  const label = type && ['docx','xlsx','pptx','pdf'].includes(type) ? t(`office.type.${type}`) : t('office.type.docx');

  return (
    <div style={{
      height: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text)',
    }}>
      {error ? (
        <OfficeErrorState title={t('office.new.failedType',{type:label})} message={error}
          color={officeColor(type?({docx:'documents',xlsx:'spreadsheets',pptx:'presentations',pdf:'pdf'}[type]):undefined)}
          onRetry={()=>{ran.current=false;setError('');setAttempt(n=>n+1);}} />
      ) : (
        <>
          <Loader2 size={34} className="animate-spin" style={{ color: 'var(--amber)' }} />
          <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>{t('office.new.creating',{type:label})}</div>
        </>
      )}
    </div>
  );
}
