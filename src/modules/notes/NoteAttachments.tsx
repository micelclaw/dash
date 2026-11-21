import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Paperclip,Replace,Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { NoteAttachment } from '@/types/notes';
import { useOriginRefresh } from '@/hooks/use-origin-refresh';
import { useI18n } from '@/i18n';

const reasonKeys = { unsupported: 'notes.reason.unsupported', too_large: 'notes.reason.tooLarge',
  unsafe_destination: 'notes.reason.unsafe', unavailable: 'notes.reason.unavailable' } as const;

export function NoteAttachments({ noteId, refreshKey, onItems, compact = false,onAdd,onReplace }: { noteId: string; refreshKey?: unknown; compact?: boolean;
  onAdd?:()=>void;onReplace?:(item:NoteAttachment)=>void;
  onItems?: (items: NoteAttachment[]) => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<NoteAttachment[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  useEffect(() => { onItems?.(items); }, [items, onItems]);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await api.get<ApiResponse<NoteAttachment[]>>(`/notes/${noteId}/attachments`);
      if (!Array.isArray(result.data)) throw new Error('Invalid attachment response');
      if (mounted.current && request === generation.current) { setItems(result.data); setError(false); }
    } catch {
      if (mounted.current && request === generation.current) { setItems([]); setError(true); }
    } finally { if (mounted.current && request === generation.current) setLoading(false); }
  }, [noteId]);
  useEffect(() => {
    // Parent keys this component by noteId: a new note starts with fresh initial state.
    mounted.current = true;
    queueMicrotask(() => { if (mounted.current) void reload(); });
    // This is a request-generation counter, not a DOM ref: invalidate all outstanding requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { mounted.current = false; generation.current++; };
  }, [reload]);
  useEffect(() => {
    let active = true;
    if (refreshKey) queueMicrotask(() => { if (active) void reload(); });
    return () => { active = false; };
  }, [refreshKey, reload]);
  useOriginRefresh('notes', reload);
  async function download(item: NoteAttachment) {
    const request = generation.current; setDownloading(item.id);
    try {
      const result = await api.getBlob(`/notes/${noteId}/attachments/${item.id}/download`);
      if (!mounted.current || generation.current !== request) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a'); link.href = url; link.download = item.filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (mounted.current && generation.current === request) toast.error(t('notes.downloadFailed')); }
    finally { if (mounted.current) setDownloading(null); }
  }
  if (!loading && !error && !items.length&&!onAdd) return null;
  return (
    <section aria-label={t('notes.attachmentsLabel')} className="border-t border-[var(--border)] px-4 py-2 text-xs">
      {onAdd&&<button type="button" onClick={onAdd} className="mb-2 inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1" title={t('notes.addAttachmentHint')}><Plus size={12}/>{t('notes.addAttachment')}</button>}
      <details {...(compact ? {} : { open: true })}>
      <summary className="mb-1 flex cursor-pointer items-center gap-1 text-[var(--text-dim)]"><Paperclip size={12} /> {t('notes.attachments')}{items.length ? ` (${items.length})` : ''}</summary>
      {loading ? <p role="status">{t('notes.loadingAttachments')}</p> : error ?
        <div role="alert">{t('notes.attachmentsFailed')} <button type="button" onClick={() => void reload()}>{t('notes.retryAttachments')}</button></div> :
        <ul className="space-y-1">{items.map(item => <li key={item.id} data-note-attachment-id={item.id} className="flex flex-wrap items-center gap-2">
          <span>{item.filename}</span>
          <span className="text-[var(--text-dim)]">{item.kind === 'copied' ? t('notes.copied') : t('notes.notCopied')}</span>
          {item.kind === 'external' && <span className="text-[var(--text-dim)]">{item.reason ? t(reasonKeys[item.reason]) : t('notes.sourceOnly')}</span>}
          {item.kind === 'copied' && <button type="button" aria-label={t('notes.file.download', { filename: item.filename })} disabled={downloading !== null}
            className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 disabled:opacity-50" onClick={() => void download(item)}>
            <Download size={12} /> {downloading === item.id ? t('notes.downloading') : t('notes.download')}
          </button>}
          {onReplace&&item.replace_supported&&item.kind==='copied'&&/^[a-f0-9-]{36}\/file\/url$/i.test(item.resource_ref??'')&&
           ['image/png','image/jpeg','image/gif','image/webp','application/pdf'].includes(item.mime_type??'')&&
           <button type="button" aria-label={t('notes.file.replace', { filename: item.filename })} className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1" onClick={()=>onReplace(item)}><Replace size={12}/>{t('notes.replace')}</button>}
        </li>)}</ul>}
      </details>
    </section>
  );
}
