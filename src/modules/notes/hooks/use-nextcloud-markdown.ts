import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';
import type { Note } from '@/types/notes';

/** The ordinary NoteEditor stays in use; only its connected save path differs. */
export function useNextcloudMarkdown(note: Note | null, onConfirmed: (note: Note) => void,
  titlePending?: RefObject<boolean>) {
  const active = note?.sync?.provider === 'nextcloud-notes';
  const eligible = Boolean(active && note.sync?.owner && note.sync.write_certified &&
    note.sync.remote_editable !== false &&
    note.sync.state === 'synced' && note.content_format === 'markdown' && note._shared_permission !== 'read');
  const session = useRef<{ id: string; baseline: string; draft: string; revision: string; uncertain: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const confirm = useRef(onConfirmed); confirm.current = onConfirmed;
  const allowed = useRef(eligible); allowed.current = eligible;
  const title = useRef(titlePending); title.current = titlePending;
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const refresh = () => setVersion(value => value + 1);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!active || !note) { session.current = null; refresh(); return; }
    const current = session.current;
    if (current?.id === note.id && (busy.current || current.draft !== current.baseline ||
      current.revision === note.sync?.local_revision)) return;
    if (timer.current) clearTimeout(timer.current);
    session.current = { id: note.id, baseline: note.content, draft: note.content,
      revision: note.sync?.local_revision ?? '', uncertain: false };
    setError(''); setStatus(''); refresh();
  }, [active, note?.id, note?.content, note?.sync?.local_revision]);

  const flushRef = useRef<() => Promise<void>>(async () => {});
  const flush = useCallback(async () => {
    const state = session.current;
    if (!state || busy.current || state.uncertain || state.draft === state.baseline ||
      !allowed.current || title.current?.current || !state.revision) return;
    const submitted = state.draft;
    busy.current = true; setSaving(true); setError('');
    try {
      await api.post(`/notes/${state.id}/sync-edit`, {
        expected_local_revision: state.revision, operations: [{ op: 'replace_body', content: submitted }],
      }, { timeout: 150_000 });
      const sync = await api.get<ApiResponse<{ state: string }>>(`/notes/${state.id}/sync-state`);
      if (sync.data.state !== 'synced') throw new Error('Nextcloud aún no confirmó el cambio. El borrador se conserva.');
      const fresh = (await api.get<ApiResponse<Note>>(`/notes/${state.id}`)).data;
      if (!fresh.sync?.local_revision || fresh.content !== submitted)
        throw new Error('La lectura no confirmó el contenido. El borrador se conserva.');
      if (session.current !== state || !mounted.current) return;
      state.baseline = submitted; state.revision = fresh.sync.local_revision;
      confirm.current(state.draft === submitted ? fresh : { ...fresh, content: state.draft });
      setStatus('Guardado en Nextcloud.');
    } catch (reason) {
      if (session.current === state && mounted.current) {
        state.uncertain = true;
        setError(`${reason instanceof Error ? reason.message : 'No se pudo confirmar el guardado'}. El borrador se conserva.`);
      }
      return; // Never replay an ambiguous remote PUT automatically.
    } finally {
      busy.current = false;
      if (mounted.current) { setSaving(false); refresh(); }
    }
    if (session.current === state && state.draft !== state.baseline)
      timer.current = setTimeout(() => void flushRef.current(), 1200);
  }, []);
  flushRef.current = flush;

  const onChange = useCallback((markdown: string) => {
    const state = session.current;
    if (!state || !allowed.current || title.current?.current || state.uncertain) return;
    state.draft = markdown; setStatus(''); refresh();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 1200);
  }, []);
  const current = session.current?.id === note?.id ? session.current : null;
  void version;
  return { active, enabled: eligible && Boolean(current) && !current?.uncertain && !titlePending?.current,
    dirty: Boolean(current && current.draft !== current.baseline), saving, error, status,
    onChange, hasPending: () => busy.current || Boolean(session.current && session.current.draft !== session.current.baseline) };
}
