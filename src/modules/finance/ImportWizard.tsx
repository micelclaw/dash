/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Asistente de importación CSV/OFX (3 pasos: Subir/Pegar → Mapear → Previsualizar +
// Confirmar). Tipos: extracto bancario (→ conciliación), movimientos, plan de cuentas,
// contactos. Llama a /finance/import/csv/:type/{preview,commit}. Reutilizable: se le
// puede fijar el tipo y la cuenta (p.ej. desde el panel de Conciliación).

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, FileUp, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { useEscapeClose } from './use-escape-close';

export type ImportType = 'bank-statement' | 'journal-entries' | 'accounts' | 'contacts';

const TYPES: { id: ImportType; label: string; desc: string }[] = [
  { id: 'bank-statement', label: 'Extracto bancario', desc: 'CSV u OFX del banco → líneas para conciliar' },
  { id: 'journal-entries', label: 'Movimientos', desc: 'Ingresos/gastos a una cuenta' },
  { id: 'accounts', label: 'Plan de cuentas', desc: 'Cuentas contables (código, nombre, tipo)' },
  { id: 'contacts', label: 'Contactos', desc: 'Clientes y proveedores' },
];
const FIELD_LABELS: Record<string, string> = { date: 'Fecha', amount: 'Importe', description: 'Concepto', code: 'Código', name: 'Nombre', type: 'Tipo', tax_id: 'NIF/CIF' };
const TYPE_FIELDS: Record<ImportType, string[]> = {
  'bank-statement': ['date', 'amount', 'description'], 'journal-entries': ['date', 'amount', 'description'],
  'accounts': ['code', 'name', 'type'], 'contacts': ['name', 'tax_id'],
};
const REQUIRED: Record<ImportType, string[]> = { 'bank-statement': ['date', 'amount'], 'journal-entries': ['date', 'amount'], 'accounts': ['name'], 'contacts': ['name'] };
const NEEDS_ACCOUNT = new Set<ImportType>(['bank-statement', 'journal-entries']);

interface PreviewData { format: 'csv' | 'ofx'; columns: string[]; sample_rows: string[][]; total_rows: number; suggested_mapping: Record<string, number>; }
interface CommitData { batch_id: string; counts: { created: number; skipped: number; failed: number }; failed: { index: number; error: string }[]; }
interface Account { id: string; code: string | null; name: string; subtype: string | null; }

export function ImportWizard({ open, onClose, fixedType, fixedAccountId, onDone }: { open: boolean; onClose: () => void; fixedType?: ImportType; fixedAccountId?: string; onDone?: () => void }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ImportType>(fixedType ?? 'bank-statement');
  const [text, setText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [accountId, setAccountId] = useState(fixedAccountId ?? '');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommitData | null>(null);

  useEscapeClose(open, onClose);
  useEffect(() => { if (open && NEEDS_ACCOUNT.has(type) && !fixedAccountId) api.get<{ data: Account[] }>('/finance/accounts').then((r) => setAccounts((r.data ?? []).filter((a) => ['bank', 'cash', 'credit_card'].includes(a.subtype ?? '')))).catch(() => {}); }, [open, type, fixedAccountId]);
  useEffect(() => { if (!open) { setStep(1); setText(''); setPreview(null); setResult(null); setMapping({}); if (!fixedType) setType('bank-statement'); if (!fixedAccountId) setAccountId(''); } }, [open, fixedType, fixedAccountId]);

  if (!open) return null;

  const doPreview = async () => {
    if (!text.trim()) { toast.error('Pega o sube un fichero'); return; }
    setBusy(true);
    try {
      const r = (await api.post<{ data: PreviewData }>(`/finance/import/csv/${type}/preview`, { text, has_header: hasHeader })).data;
      setPreview(r); setMapping(r.suggested_mapping ?? {}); setStep(2);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo leer el fichero'); } finally { setBusy(false); }
  };
  const doCommit = async () => {
    setBusy(true);
    try {
      const r = (await api.post<{ data: CommitData }>(`/finance/import/csv/${type}/commit`, { text, has_header: hasHeader, mapping, account_id: NEEDS_ACCOUNT.has(type) ? accountId : undefined })).data;
      setResult(r); setStep(3); onDone?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'La importación falló'); } finally { setBusy(false); }
  };

  const fields = TYPE_FIELDS[type];
  const mappingOk = REQUIRED[type].every((f) => mapping[f] != null && mapping[f] >= 0) || preview?.format === 'ofx';
  const accountOk = !NEEDS_ACCOUNT.has(type) || !!accountId;
  const fld = 'px-2 py-1.5 text-sm rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] w-full';

  return (
    <div onClick={onClose} className="fixed inset-0 z-[400] flex items-start justify-center pt-[6vh]" style={{ background: 'var(--glass-modal, rgba(0,0,0,0.6))' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-[660px] max-w-[94vw] max-h-[86vh] overflow-y-auto rounded-[var(--radius-lg,12px)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2"><FileUp size={18} className="text-[var(--mod-finance)]" /> Importar datos</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={18} /></button>
        </div>
        {/* Pasos */}
        <div className="flex items-center gap-2 mb-4 text-xs">
          {['Origen', 'Mapear', 'Confirmar'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full font-semibold ${step === i + 1 ? 'bg-[var(--mod-finance)] text-white' : step > i + 1 ? 'bg-[var(--surface)] text-[var(--green)]' : 'bg-[var(--surface)] text-[var(--text-dim)]'}`}>{i + 1}. {s}</span>
              {i < 2 && <ArrowRight size={12} className="text-[var(--text-dim)]" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            {!fixedType && (
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setType(t.id)} className={`text-left p-2.5 rounded-[var(--radius-md,8px)] border ${type === t.id ? 'border-[var(--mod-finance)] bg-[var(--surface)]' : 'border-[var(--border)]'}`}>
                    <div className="text-sm font-semibold text-[var(--text)]">{t.label}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">{t.desc}</div>
                  </button>
                ))}
              </div>
            )}
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder={'Pega aquí el CSV (o OFX para extracto)…\nFecha;Concepto;Importe\n10/06/2026;Transferencia;1.234,56'} className="min-h-[140px] resize-y rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] p-2.5 font-mono text-xs" />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-[var(--text-dim)]"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La primera fila es cabecera</label>
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)] cursor-pointer"><FileUp size={13} /> Subir fichero<input type="file" accept=".csv,.ofx,.txt,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setText(typeof r.result === 'string' ? r.result : ''); r.readAsText(f); } e.target.value = ''; }} /></label>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-[var(--text-dim)]">Detectadas <b className="text-[var(--text)]">{preview.total_rows}</b> filas ({preview.format.toUpperCase()}). {preview.format === 'ofx' ? 'OFX se mapea automáticamente.' : 'Asocia cada campo a su columna.'}</div>
            {preview.format === 'csv' && (
              <div className="grid grid-cols-3 gap-2">
                {fields.map((f) => (
                  <label key={f} className="text-xs text-[var(--text-dim)] flex flex-col gap-1">{FIELD_LABELS[f] ?? f}{REQUIRED[type].includes(f) && ' *'}
                    <select value={mapping[f] ?? -1} onChange={(e) => setMapping((m) => ({ ...m, [f]: Number(e.target.value) }))} className={fld}>
                      <option value={-1}>— ninguna —</option>
                      {preview.columns.map((c, i) => <option key={i} value={i}>{c}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
            {NEEDS_ACCOUNT.has(type) && !fixedAccountId && (
              <label className="text-xs text-[var(--text-dim)] flex flex-col gap-1">Cuenta destino *
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fld}>
                  <option value="">— elige cuenta —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>)}
                </select>
              </label>
            )}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
              <table className="w-full text-[12px]">
                <thead><tr className="bg-[var(--surface)] text-[var(--text-dim)]">{preview.columns.map((c, i) => <th key={i} className="text-left px-2 py-1.5 font-medium">{c}</th>)}</tr></thead>
                <tbody>{preview.sample_rows.slice(0, 8).map((r, i) => <tr key={i} className="border-t border-[var(--border)]">{preview.columns.map((_, j) => <td key={j} className="px-2 py-1 text-[var(--text)]">{r[j] ?? ''}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={40} className="text-[var(--green)]" />
            <div className="text-sm text-[var(--text)]"><b>{result.counts.created}</b> importadas{result.counts.skipped > 0 && <> · <b>{result.counts.skipped}</b> ya existían (omitidas)</>}{result.counts.failed > 0 && <> · <b className="text-[var(--amber)]">{result.counts.failed}</b> con error</>}</div>
            {result.failed.length > 0 && <div className="text-xs text-[var(--text-dim)] max-h-24 overflow-auto">{result.failed.slice(0, 5).map((f) => <div key={f.index}>Fila {f.index + 1}: {f.error}</div>)}</div>}
          </div>
        )}

        <div className="flex justify-between gap-2 mt-5">
          <button onClick={step === 2 ? () => setStep(1) : onClose} className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border border-[var(--border)] text-[var(--text-dim)] inline-flex items-center gap-1.5">{step === 2 ? <><ArrowLeft size={13} /> Atrás</> : 'Cancelar'}</button>
          {step === 1 && <button onClick={() => void doPreview()} disabled={busy || !text.trim()} className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white disabled:opacity-50 inline-flex items-center gap-1.5">{busy ? <Loader2 size={13} className="animate-spin" /> : <>Leer <ArrowRight size={13} /></>}</button>}
          {step === 2 && <button onClick={() => void doCommit()} disabled={busy || !mappingOk || !accountOk} className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white disabled:opacity-50 inline-flex items-center gap-1.5">{busy ? <Loader2 size={13} className="animate-spin" /> : 'Importar'}</button>}
          {step === 3 && <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm,4px)] border-none bg-[var(--mod-finance)] text-white">Cerrar</button>}
        </div>
      </div>
    </div>
  );
}
