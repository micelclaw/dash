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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Mail, PanelLeftClose, PanelLeftOpen, Menu, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { SplitPane } from '@/components/shared/SplitPane';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-media-query';
import { useBackGuard } from '@/hooks/use-back-guard';
import { useWebSocket } from '@/hooks/use-websocket';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMailState } from './hooks/use-mail-state';
import { useEmails } from './hooks/use-emails';
import { useEmailAccounts } from './hooks/use-email-accounts';
import { useMailFolders } from './hooks/use-mail-folders';
import { buildMoveTargets } from './lib/move-targets';
import type { MailActionKey } from './lib/mail-actions';
import { MailSidebar } from './MailSidebar';
import { MailList } from './MailList';
import { MailReadingPane } from './MailReadingPane';
import { MailComposer } from './MailComposer';
import { MailSnoozeMenu } from './MailSnoozeMenu';
import type { ComposeData } from './types';

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = () => setIsTablet(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTablet;
}

export function Component() {
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const {
    activeAccount, setActiveAccount,
    activeFolder, setActiveFolder,
    activeLabel, setActiveLabel,
    selectedEmailId, setSelectedEmailId,
    selectedIds, toggleSelection, selectAll, clearSelection,
    composerData, openComposer, closeComposer,
    sortField, sortOrder, setSort,
    starredOnly, toggleStarredOnly,
  } = useMailState();

  // Filters + pagination
  const [search, setSearch] = useState('');
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  // Móvil: drawer con el side panel de correo (cuentas + carpetas).
  const [mobileNav, setMobileNav] = useState(false);

  // Back jerárquico móvil: atrás cierra el overlay activo (composer/lectura) antes de salir.
  useBackGuard(composerData?.mode === 'new', () => closeComposer(), isMobile);
  useBackGuard(!!selectedEmailId, () => setSelectedEmailId(null), isMobile);

  // Reset page when folder/account/search/sort/starred changes
  useEffect(() => {
    setPage(0);
  }, [activeFolder, activeLabel, activeAccount, search, sortField, sortOrder, starredOnly]);

  const {
    emails, meta, loading, error, fetchEmails,
    markRead, markUnread, toggleStar,
    archiveEmail, moveToFolder, deleteEmail, restoreEmail, snoozeEmail,
    sendEmail, batchAction,
  } = useEmails({
    // Con una etiqueta seleccionada NO se filtra por carpeta: en Gmail la
    // etiqueta atraviesa Entrada, Enviados y Archivo.
    folder: activeLabel ? undefined : activeFolder,
    label: activeLabel || undefined,
    account_id: activeAccount || undefined,
    search: search || undefined,
    is_starred: starredOnly || undefined,
    sort: sortField,
    order: sortOrder,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { accounts, refetch: refetchAccounts } = useEmailAccounts();
  const { systemFolders, customFolders, mailLabels } = useMailFolders();

  // Account context menu actions
  const handleUnsyncAccount = useCallback(async (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    if (!window.confirm(`Unsync "${acc.name}"? The account will be removed from Mail.`)) return;
    try {
      await api.delete(`/email-accounts/${id}`);
      toast.success(`"${acc.name}" removed`);
      if (activeAccount === id) setActiveAccount(null);
      refetchAccounts();
    } catch {
      toast.error('Failed to unsync account');
    }
  }, [accounts, activeAccount, setActiveAccount, refetchAccounts]);

  const handleChangeAccountColor = useCallback(async (id: string, color: string) => {
    try {
      await api.patch(`/email-accounts/${id}`, { color });
      refetchAccounts();
    } catch (err: any) {
      toast.error(`Failed to change color: ${err?.message || 'unknown error'}`);
    }
  }, [refetchAccounts]);

  // Export
  const handleExport = useCallback(async (accountId: string | null, folders: string[]) => {
    const isWindows = navigator.userAgent.includes('Windows');

    try {
      if (isWindows) {
        // Download CSV to browser
        const { useAuthStore } = await import('@/stores/auth.store');
        const token = useAuthStore.getState().tokens?.accessToken;
        const baseUrl = import.meta.env.VITE_API_URL ?? '';
        const res = await fetch(`${baseUrl}/api/v1/emails/export/csv`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ account_id: accountId, folders }),
        });
        if (!res.ok) throw new Error('Export failed');

        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        const filename = filenameMatch?.[1] || 'export-mails.csv';

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${filename}`);
      } else {
        // Save to Drive on server
        const res = await api.post<{ data: { saved_to: string; email_count: number } }>('/emails/export/csv', {
          account_id: accountId,
          folders,
          save_to_drive: true,
        });
        toast.success(`Saved ${res.data.saved_to} (${res.data.email_count} emails)`);
      }
    } catch {
      toast.error('Export failed');
    }
  }, []);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const pendingSyncsRef = useRef<Set<string>>(new Set());
  const syncFallbackRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncCompleted = useWebSocket('sync.completed');
  const syncError = useWebSocket('sync.error');

  useEffect(() => {
    if (!syncCompleted || pendingSyncsRef.current.size === 0) return;
    const cid = syncCompleted.data?.connector_id as string | undefined;
    if (cid && pendingSyncsRef.current.has(cid)) {
      pendingSyncsRef.current.delete(cid);
      fetchEmails();
      if (pendingSyncsRef.current.size === 0) {
        clearTimeout(syncFallbackRef.current);
        setSyncing(false);
      }
    }
  }, [syncCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!syncError || pendingSyncsRef.current.size === 0) return;
    const cid = syncError.data?.connector_id as string | undefined;
    if (cid && pendingSyncsRef.current.has(cid)) {
      pendingSyncsRef.current.delete(cid);
      toast.error(`Sync error: ${syncError.data?.error ?? 'unknown'}`);
      if (pendingSyncsRef.current.size === 0) {
        clearTimeout(syncFallbackRef.current);
        setSyncing(false);
      }
    }
  }, [syncError]);

  useEffect(() => {
    return () => clearTimeout(syncFallbackRef.current);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      // Find all email connectors (IMAP + Gmail)
      const res = await api.get<{ data: Array<{ id: string; connector_type: string; status: string; domains: string[] }> }>('/sync/connectors');
      const connectors = res.data.filter(c => (c.domains ?? []).includes('emails') && c.status !== 'disconnected');
      if (connectors.length === 0) {
        toast.error('No email connectors configured');
        setSyncing(false);
        return;
      }
      pendingSyncsRef.current = new Set(connectors.map(c => c.id));
      for (const c of connectors) {
        await api.post(`/sync/connectors/${c.id}/run`);
      }
      toast.success('Sync started');
      // Fallback: if WS never fires, reset after 120s
      clearTimeout(syncFallbackRef.current);
      syncFallbackRef.current = setTimeout(() => {
        pendingSyncsRef.current.clear();
        setSyncing(false);
        fetchEmails();
      }, 120_000);
    } catch {
      toast.error('Sync failed');
      setSyncing(false);
    }
  }, [fetchEmails]);

  // Collapsible list
  const [listCollapsed, setListCollapsed] = useState(false);

  // Snooze menu. Lleva una LISTA porque aplazar ya se ofrece también en
  // selección múltiple (antes solo existía en la esquina de la fila).
  const [snoozeTarget, setSnoozeTarget] = useState<{ ids: string[]; el: HTMLElement } | null>(null);

  // URL sync
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setSelectedEmailId(id);
  }, [searchParams, setSelectedEmailId]);

  // Deep-link de compose (?compose=1&to=&subject=&body=) — usado por las companions
  // (mailto: de MiniMicel, "Enviar por correo" de CrawlMicel).
  useEffect(() => {
    if (searchParams.get('compose') !== '1') return;
    const to = searchParams.get('to') ?? '';
    openComposer({
      mode: 'new',
      to: to ? [{ address: to }] : undefined,
      subject: searchParams.get('subject') ?? undefined,
      body_html: searchParams.get('body') ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleSelection = useCallback((id: string, shiftKey: boolean) => {
    toggleSelection(id, shiftKey, emails.map(e => e.id));
  }, [toggleSelection, emails]);

  const handleCompose = useCallback(() => {
    openComposer({ mode: 'new' });
  }, [openComposer]);

  const handleReply = useCallback((data: Partial<ComposeData>) => {
    openComposer({ mode: 'reply', ...data } as ComposeData);
  }, [openComposer]);

  const handleForward = useCallback((data: Partial<ComposeData>) => {
    openComposer({ mode: 'forward', ...data } as ComposeData);
  }, [openComposer]);

  const handleSnoozeConfirm = useCallback((until: string) => {
    if (!snoozeTarget) return;
    const { ids } = snoozeTarget;
    const [primero] = ids;
    if (ids.length === 1 && primero) snoozeEmail(primero, until);
    else batchAction(ids, 'snooze', { until });
    setSnoozeTarget(null);
  }, [snoozeTarget, snoozeEmail, batchAction]);

  // ─── El despachador ÚNICO de acciones sobre correos ─────────────────────
  //
  // Un solo sitio al que llaman las TRES superficies (la esquina de la fila, el
  // menú del botón derecho y la barra de selección múltiple), para que hagan lo
  // mismo. Antes cada una tenía su propia lista y su propio cableado, y por eso
  // se olvidaban de cosas distintas.
  //
  // Con UN correo se usan los caminos de siempre (traen su deshacer y su pintado
  // optimista); con varios, el lote del servidor. Misma lista de acciones, el
  // mejor comportamiento en cada caso.
  const runMailAction = useCallback((
    key: MailActionKey,
    ids: string[],
    params?: { folder?: string; label?: string; el?: HTMLElement },
  ) => {
    if (ids.length === 0) return;
    const uno = ids.length === 1 ? ids[0] ?? null : null;
    const lote = (accion: string, p?: Record<string, string>) => batchAction(ids, accion, p);

    /** Uno con su camino de siempre, varios con el lote. */
    const unoOLote = (conUno: (id: string) => void, accion: string, p?: Record<string, string>) => {
      if (uno) conUno(uno); else lote(accion, p);
    };

    switch (key) {
      case 'read':      unoOLote((id) => markRead(id), 'mark_read'); break;
      case 'unread':    unoOLote((id) => markUnread(id), 'mark_unread'); break;
      // `toggleStar` alterna; en lote el servidor tiene las dos acciones por
      // separado, así que la intención («destacar» / «quitar») no se pierde con
      // una selección en estados mezclados.
      case 'star':      unoOLote((id) => toggleStar(id), 'star'); break;
      case 'unstar':    unoOLote((id) => toggleStar(id), 'unstar'); break;
      case 'archive':   unoOLote((id) => archiveEmail(id), 'move', { folder: 'Archive' }); break;
      case 'unarchive': unoOLote((id) => moveToFolder(id, 'INBOX'), 'move', { folder: 'INBOX' }); break;
      case 'spam':      unoOLote((id) => moveToFolder(id, 'SPAM'), 'move', { folder: 'SPAM' }); break;
      case 'notspam':   unoOLote((id) => moveToFolder(id, 'INBOX'), 'move', { folder: 'INBOX' }); break;
      case 'delete':    unoOLote((id) => deleteEmail(id), 'delete'); break;
      case 'restore':   unoOLote((id) => restoreEmail(id), 'restore'); break;
      case 'snooze':
        // Necesita una fecha: abre el menú, que ya sabe de listas.
        if (params?.el) setSnoozeTarget({ ids, el: params.el });
        break;
      case 'move':
        // Una etiqueta no es una carpeta: en Gmail el correo NO se mueve, se le
        // añade la etiqueta (y sigue donde estaba).
        if (params?.label) {
          // También con UNO se usa el lote: es el único camino que AÑADE la
          // etiqueta. Lo que había antes ponía `folder = 'Empleo'`, o sea que
          // inventaba una carpeta con el nombre de la etiqueta — y en Gmail no
          // existen las carpetas, así que eso no llegaba a ninguna parte.
          lote('add_label', { label: params.label });
        } else if (params?.folder) {
          const destino = params.folder;
          if (uno) moveToFolder(uno, destino); else lote('move', { folder: destino });
        }
        break;
      case 'relate':
        // Habla de UN registro: lo abre la propia fila (tiene el modal).
        break;
    }
  }, [batchAction, markRead, markUnread, toggleStar, archiveEmail, moveToFolder,
      deleteEmail, restoreEmail]);

  // Keyboard shortcuts
  const composerOpen = !!composerData;
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (composerOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key) {
        case 'c':
          e.preventDefault();
          handleCompose();
          break;
        case 'e':
          if (selectedEmailId) { e.preventDefault(); archiveEmail(selectedEmailId); setSelectedEmailId(null); }
          break;
        case '#':
          if (selectedEmailId) { e.preventDefault(); deleteEmail(selectedEmailId); setSelectedEmailId(null); }
          break;
        case 'r':
          // Reply handled by reading pane
          break;
        case 's':
          if (selectedEmailId) { e.preventDefault(); toggleStar(selectedEmailId); }
          break;
        case 'u':
          if (selectedEmailId) { e.preventDefault(); markUnread(selectedEmailId); }
          break;
        case 'Escape':
          if (selectedEmailId) { e.preventDefault(); setSelectedEmailId(null); }
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [composerOpen, selectedEmailId, handleCompose, archiveEmail, deleteEmail, toggleStar, markUnread, setSelectedEmailId]);

  const accountColorMap = accounts.map(a => ({ id: a.id, color: a.color }));

  // ¿Está TODO lo seleccionado destacado? Decide si el menú ofrece «destacar» o
  // «quitar destacado». Se mira el dato, no se supone: con una selección mixta lo
  // que se quiere es poner la estrella a los que no la tienen.
  const allSelectedStarred = selectedIds.size > 0
    && emails.filter((e) => selectedIds.has(e.id)).every((e) => e.is_starred);

  // Los destinos de «Mover a…»: la MISMA lista que pinta la barra lateral, así
  // que lo que se ve es lo que se puede elegir.
  //
  // Es una FUNCIÓN de la cuenta, no una lista fija: cada correo solo puede
  // moverse a las carpetas de SU cuenta (mover a la de otra cuenta sería copiar
  // entre proveedores, que no existe). Se memoiza por cuenta para no recalcular
  // por fila.
  const moveTargetsFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof buildMoveTargets>>();
    return (accountId: string | null) => {
      const clave = accountId ?? '';
      const ya = cache.get(clave);
      if (ya) return ya;
      const targets = buildMoveTargets({
        systemFolders,
        customFolders,
        mailLabels,
        accountEmail: (id) => accounts.find((a) => a.id === id)?.email_address,
        currentFolder: activeLabel ?? activeFolder,
        accountId,
      });
      cache.set(clave, targets);
      return targets;
    };
  }, [systemFolders, customFolders, mailLabels, accounts, activeFolder, activeLabel]);

  // Mobile: single column stack
  if (isMobile) {
    if (composerData?.mode === 'new' && !selectedEmailId) {
      return (
        <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
          <MailComposer
            data={composerData}
            onClose={closeComposer}
            onSend={sendEmail}
            accounts={accounts}
            inline
          />
        </div>
      );
    }
    if (selectedEmailId) {
      return (
        <div style={{ height: '100%' }}>
          <MailReadingPane
            emailId={selectedEmailId}
            onBack={() => setSelectedEmailId(null)}
            onReply={handleReply}
            onForward={handleForward}
            composerData={composerData}
            onSend={sendEmail}
            onCloseComposer={closeComposer}
            accounts={accounts}
          />
        </div>
      );
    }
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Cabecera móvil: hamburguesa (cuentas/carpetas) + botón permanente "Nuevo email". */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            aria-label="Cuentas y carpetas"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, flexShrink: 0,
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text)', cursor: 'pointer',
            }}
          >
            <Menu size={18} />
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleCompose}
            aria-label="Nuevo email"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 34, padding: '0 12px', flexShrink: 0,
              background: 'var(--amber)', color: '#06060a', border: 'none',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
            }}
          >
            <Pencil size={16} />
            New
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
        <MailList
          emails={emails}
          loading={loading}
          error={error}
          selectedEmailId={selectedEmailId}
          onSelectEmail={setSelectedEmailId}
          selectedIds={selectedIds}
          onToggleSelection={handleToggleSelection}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          search={search}
          onSearchChange={setSearch}
          onRefresh={fetchEmails}
          onAction={runMailAction}
          allSelectedStarred={allSelectedStarred}
          activeFolder={activeFolder}
          accounts={accountColorMap}
          moveTargetsFor={moveTargetsFor}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={setSort}
          starredOnly={starredOnly}
          onToggleStarredOnly={toggleStarredOnly}
          page={page}
          pageSize={PAGE_SIZE}
          total={meta?.total ?? 0}
          onPageChange={setPage}
        />
        </div>
        {snoozeTarget && (
          <MailSnoozeMenu
            open
            onClose={() => setSnoozeTarget(null)}
            onSnooze={handleSnoozeConfirm}
            anchorEl={snoozeTarget.el}
          />
        )}
        {/* Drawer con el side panel de correo (mismo MailSidebar que escritorio). */}
        <Sheet open={mobileNav} onOpenChange={setMobileNav}>
          <SheetContent side="left" style={{ width: 260, padding: 0, paddingTop: 'env(safe-area-inset-top, 0px)', overflow: 'hidden' }} aria-describedby={undefined}>
            <MailSidebar
              systemFolders={systemFolders}
              customFolders={customFolders}
              mailLabels={mailLabels}
              activeAccount={activeAccount}
              activeFolder={activeFolder}
              activeLabel={activeLabel}
              onAccountChange={(id) => { setActiveAccount(id); setMobileNav(false); }}
              onFolderChange={(f) => { setActiveFolder(f); setMobileNav(false); }}
              onLabelChange={(l) => { setActiveLabel(l); setMobileNav(false); }}
              collapsed={false}
              onCompose={() => { setMobileNav(false); handleCompose(); }}
              onSync={handleSync}
              syncing={syncing}
              accounts={accounts}
              onUnsyncAccount={handleUnsyncAccount}
              onChangeAccountColor={handleChangeAccountColor}
              onExport={handleExport}
              onAccountRenamed={refetchAccounts}
            />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop / Tablet: sidebar + resizable split pane
  const sidebarWidth = isTablet ? 56 : 200;

  /*
    El panel de lectura, extraído para poder pintarlo en DOS sitios: dentro del
    divisor (con la lista) y a ancho completo cuando la lista está oculta.

    Antes, ocultar la lista dejaba su columna vacía: `defaultSizes` solo se lee
    al montar (y el tamaño guardado del divisor manda sobre él), así que pasar
    `[0, 100]` al colapsar no hacía nada y quedaba un hueco negro del 35 %.
  */
  const panelLectura = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Collapse/expand toggle */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setListCollapsed((prev) => !prev)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28,
            border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'transparent', color: 'var(--text-dim)',
            cursor: 'pointer', transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title={listCollapsed ? 'Show email list' : 'Hide email list'}
        >
          {listCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedEmailId ? (
          <MailReadingPane
            emailId={selectedEmailId}
            onReply={handleReply}
            onForward={handleForward}
            composerData={composerData ?? null}
            onSend={sendEmail}
            onCloseComposer={closeComposer}
            accounts={accounts}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' }}>
            <EmptyState
              icon={Mail}
              title="Select an email"
              description="Choose an email from the list to read"
            />
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: sidebarWidth, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
        <MailSidebar
          systemFolders={systemFolders}
          customFolders={customFolders}
          mailLabels={mailLabels}
          activeAccount={activeAccount}
          activeFolder={activeFolder}
          activeLabel={activeLabel}
          onAccountChange={setActiveAccount}
          onFolderChange={setActiveFolder}
          onLabelChange={setActiveLabel}
          collapsed={isTablet}
          onCompose={handleCompose}
          onSync={handleSync}
          syncing={syncing}
          accounts={accounts}
          onUnsyncAccount={handleUnsyncAccount}
          onChangeAccountColor={handleChangeAccountColor}
          onExport={handleExport}
          onAccountRenamed={refetchAccounts}
        />
      </div>

      {composerData?.mode === 'new' && !selectedEmailId ? (
        /* Compose NUEVO = ancho completo (solo descuenta el sidebar), consistente
           para todos e independiente del arrastre persistido del SplitPane. Antes
           se pintaba en el panel derecho (65% por defecto) salvo que el usuario
           hubiera arrastrado el divisor a tope — por eso Víctor (divisor arrastrado)
           lo veía full y María (fresh, 65%) no. */
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <MailComposer
            data={composerData}
            onClose={closeComposer}
            onSend={sendEmail}
            accounts={accounts}
            inline
          />
        </div>
      ) : listCollapsed ? (
        /* Lista oculta: el panel de lectura ocupa TODO el ancho. */
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{panelLectura}</div>
      ) : (
      <SplitPane
        // Solo el reparto INICIAL: aquí `listCollapsed` es siempre false (con la
        // lista oculta no se pinta el divisor) y, si el usuario ya arrastró, su
        // tamaño guardado manda sobre esto.
        defaultSizes={[35, 65]}
        minSizes={[200, 300]}
        id="mail-split"
      >
      <div style={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {!listCollapsed && <MailList
          emails={emails}
          loading={loading}
          error={error}
          selectedEmailId={selectedEmailId}
          onSelectEmail={setSelectedEmailId}
          selectedIds={selectedIds}
          onToggleSelection={handleToggleSelection}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          search={search}
          onSearchChange={setSearch}
          onRefresh={fetchEmails}
          onAction={runMailAction}
          allSelectedStarred={allSelectedStarred}
          activeFolder={activeFolder}
          accounts={accountColorMap}
          moveTargetsFor={moveTargetsFor}
          sortField={sortField}
          sortOrder={sortOrder}
          onSortChange={setSort}
          starredOnly={starredOnly}
          onToggleStarredOnly={toggleStarredOnly}
          page={page}
          pageSize={PAGE_SIZE}
          total={meta?.total ?? 0}
          onPageChange={setPage}
        />}
      </div>

{panelLectura}
      </SplitPane>
      )}

      {/* Snooze menu */}
      {snoozeTarget && (
        <MailSnoozeMenu
          open
          onClose={() => setSnoozeTarget(null)}
          onSnooze={handleSnoozeConfirm}
          anchorEl={snoozeTarget.el}
        />
      )}
    </div>
  );
}
