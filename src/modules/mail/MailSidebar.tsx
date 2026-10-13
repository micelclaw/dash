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

import { EntitySource } from '@/components/shared/SourceBadge';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  Pencil,
  Mail,
  Inbox,
  Clock,
  Send,
  FileText,
  Archive,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Type,
  Unplug,
  Palette,
  Download,
  Folder,
  Tag,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { SystemFolderCount, CustomFolderCount, MailLabelCount } from './hooks/use-mail-folders';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { MailSidebarItem } from './MailSidebarItem';
import type { EmailAccount } from './types';
import { ConnectButton } from '@/components/shared/ConnectButton';
import { api } from '@/services/api';
import { toast } from 'sonner';

const ACCOUNT_COLORS: Array<{ value: string; name: string }> = [
  { value: '#d4a017', name: 'Gold' },
  { value: '#3B82F6', name: 'Blue' },
  { value: '#EF4444', name: 'Red' },
  { value: '#10B981', name: 'Green' },
  { value: '#8B5CF6', name: 'Purple' },
  { value: '#F97316', name: 'Orange' },
  { value: '#EC4899', name: 'Pink' },
  { value: '#06B6D4', name: 'Cyan' },
  { value: '#84CC16', name: 'Lime' },
  { value: '#F59E0B', name: 'Amber' },
];

// ─── El nombre que le pones a una cuenta ────────────────────────────────────
//
// Vivía SOLO en el localStorage de este navegador: renombrar la cuenta aquí no
// lo veía ni el móvil, ni la tarjeta de Ajustes, ni un agente — y al vaciar la
// caché desaparecía. Ahora el nombre se guarda en la cuenta (`PATCH
// /email-accounts/:id`) y esta lectura del localStorage se conserva solo para
// no perder los nombres que ya hubiera puestos antes: al renombrar de nuevo,
// suben al servidor y la entrada local se retira.
const RENAME_KEY = 'claw:mail:account-names';
function loadRenames(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(RENAME_KEY) || '{}'); } catch { return {}; }
}
function saveRenames(map: Record<string, string>) {
  localStorage.setItem(RENAME_KEY, JSON.stringify(map));
}

interface MailSidebarProps {
  activeAccount: string | null;
  activeFolder: string;
  /** La etiqueta seleccionada, si el usuario está mirando una en vez de una carpeta. */
  activeLabel?: string | null;
  onAccountChange: (id: string | null) => void;
  onFolderChange: (folder: string) => void;
  onLabelChange?: (label: string | null) => void;
  collapsed: boolean;
  onCompose: () => void;
  onSync?: () => void;
  syncing?: boolean;
  accounts: EmailAccount[];
  onUnsyncAccount?: (id: string) => void;
  onChangeAccountColor?: (id: string, color: string) => void;
  onExport?: (accountId: string | null, folders: string[]) => void;
  /** Para releer las cuentas cuando el nombre cambia en el servidor. */
  onAccountRenamed?: () => void;
  // Las carpetas llegan de FUERA (las lee MailPage una sola vez).
  //
  // Antes esta barra las pedía ella misma, y cuando el menú «Mover a…» de la
  // lista necesitó los mismos datos había dos opciones: pedirlos otra vez
  // —dos peticiones y dos suscripciones al mismo evento— o subirlas a quien es
  // dueño de la pantalla. Una sola lectura, un solo estado: lo que se ve en la
  // barra es exactamente lo que se ofrece como destino.
  systemFolders: SystemFolderCount[];
  customFolders: CustomFolderCount[];
  mailLabels: MailLabelCount[];
}

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: Inbox },
  // Starred is NOT a folder: a starred message lives in Inbox or in Sent like any
  // other. It is a toggle in the list toolbar, combinable with the active folder.
  { key: 'SNOOZED', label: 'Snoozed', icon: Clock },
  { key: 'SENT', label: 'Sent', icon: Send },
  { key: 'DRAFTS', label: 'Drafts', icon: FileText },
  { key: 'ARCHIVE', label: 'Archive', icon: Archive },
  { key: 'TRASH', label: 'Trash', icon: Trash2 },
  { key: 'SPAM', label: 'Spam', icon: AlertTriangle },
] as const;

export function MailSidebar({
  activeAccount,
  activeFolder,
  activeLabel = null,
  onAccountChange,
  onFolderChange,
  onLabelChange,
  collapsed,
  onCompose,
  onSync,
  syncing,
  accounts,
  onUnsyncAccount,
  onChangeAccountColor,
  onExport,
  onAccountRenamed,
  systemFolders,
  customFolders,
  mailLabels,
}: MailSidebarProps) {

  // ─── Export modal state ───
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFolders, setExportFolders] = useState<Set<string>>(new Set(['INBOX', 'SENT']));

  function toggleExportFolder(key: string) {
    setExportFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExportConfirm() {
    if (exportFolders.size === 0) return;
    onExport?.(activeAccount, [...exportFolders]);
    setExportOpen(false);
  }
  // ─── Rename state (frontend-only, persisted in localStorage) ───
  const [renames, setRenames] = useState<Record<string, string>>(loadRenames);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  function startRename(acc: EmailAccount) {
    setRenamingId(acc.id);
    setRenameValue(renames[acc.id] || acc.name);
  }

  function commitRename() {
    if (!renamingId) return;
    const id = renamingId;
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed) return;

    // El nombre viaja al servidor: es la cuenta la que se llama así, no este
    // navegador. La entrada local se retira para que no siga ganando.
    const updated = { ...renames };
    delete updated[id];
    setRenames(updated);
    saveRenames(updated);

    if (trimmed === accounts.find((a) => a.id === id)?.name) return;
    void api
      .patch(`/email-accounts/${id}`, { name: trimmed })
      .then(() => onAccountRenamed?.())
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'No se pudo renombrar la cuenta');
      });
  }

  // ─── Color picker state ───
  const [colorPickerTarget, setColorPickerTarget] = useState<string | null>(null);

  function getAccountMenuItems(acc: EmailAccount): ContextMenuItem[] {
    return [
      { label: 'Rename', icon: Type, onClick: () => startRename(acc) },
      { label: 'Change color', icon: Palette, onClick: () => setColorPickerTarget(acc.id) },
      { label: '', onClick: () => {}, separator: true },
      { label: 'Unsync account', icon: Unplug, onClick: () => onUnsyncAccount?.(acc.id), variant: 'danger' as const },
    ];
  }

  // Los números de «All» y de cada cuenta salen del SERVIDOR, no de contar la
  // página cargada: con 50 correos en memoria y 1423 sin leer, la cuenta decía
  // «23» mientras la Entrada decía 1423. Es el mismo fallo que el comentario de
  // `folderUnread` (abajo) ya reconocía para las carpetas.
  const entrada = useMemo(
    () => systemFolders.find((f) => f.folder === 'INBOX'),
    [systemFolders],
  );
  const totalUnread = entrada?.unread ?? 0;
  const totalEnEntrada = entrada?.total ?? 0;

  const porCuenta = useMemo(() => {
    const map: Record<string, { unread: number; total: number }> = {};
    for (const fila of entrada?.by_account ?? []) {
      if (fila.account_id) map[fila.account_id] = { unread: fila.unread, total: fila.total };
    }
    return map;
  }, [entrada]);

  // Counts come from the server (one grouped query). Counting over the loaded
  // page never matched: `Archive` is stored as 'Archive' but the sidebar key is
  // 'ARCHIVE', and anything outside the open folder was simply not in memory.
  //
  // Y son los de LA CUENTA ELEGIDA cuando hay una.
  //
  // Con tres cuentas conectadas, las siete carpetas enseñaban SIEMPRE el mismo
  // número —el de todas las cuentas juntas— así que al elegir una cuenta la
  // lista decía «1-50 de 211» y la Entrada seguía diciendo 2579: dos números
  // sobre lo mismo, contradiciéndose en la misma pantalla. El reparto por cuenta
  // ya venía en la misma respuesta del servidor (`by_account`, lo usa la fila de
  // cada cuenta desde que se arregló ese mismo fallo ahí); aquí simplemente no
  // se miraba. Las carpetas propias del proveedor y las etiquetas sí filtraban
  // (ver `customByAccount`), lo que hacía la incoherencia más visible.
  const cuentaDe = useCallback((row: SystemFolderCount, campo: 'unread' | 'total') => {
    if (!activeAccount) return row[campo];
    return (row.by_account ?? [])
      .filter((r) => r.account_id === activeAccount)
      .reduce((n, r) => n + r[campo], 0);
  }, [activeAccount]);

  const folderUnread = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of systemFolders) map[row.folder] = cuentaDe(row, 'unread');
    // The sidebar key for Archive differs from the stored value.
    map.ARCHIVE = map.Archive ?? 0;
    return map;
  }, [systemFolders, cuentaDe]);

  // Y los TOTALES, que el servidor ya mandaba en la misma respuesta y no se
  // pintaban: con solo los no leídos, una carpeta con todo leído no enseñaba
  // ningún número y parecía vacía.
  const folderTotal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of systemFolders) map[row.folder] = cuentaDe(row, 'total');
    map.ARCHIVE = map.Archive ?? 0;
    return map;
  }, [systemFolders, cuentaDe]);

  // The provider's own folders, grouped under the account they belong to.
  const customByAccount = useMemo(() => {
    const groups = new Map<string | null, typeof customFolders>();
    for (const row of customFolders) {
      if (activeAccount && row.account_id !== activeAccount) continue;
      const list = groups.get(row.account_id) ?? [];
      list.push(row);
      groups.set(row.account_id, list);
    }
    return [...groups.entries()];
  }, [customFolders, activeAccount]);

  // Las etiquetas de Gmail, bajo la cuenta que las trajo. Mismo criterio que las
  // carpetas del proveedor: solo se listan las que tienen correo.
  const labelsByAccount = useMemo(() => {
    const groups = new Map<string | null, typeof mailLabels>();
    for (const row of mailLabels) {
      if (activeAccount && row.account_id !== activeAccount) continue;
      const list = groups.get(row.account_id) ?? [];
      list.push(row);
      groups.set(row.account_id, list);
    }
    return [...groups.entries()];
  }, [mailLabels, activeAccount]);

  const composeButton = (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        onClick={onCompose}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flex: 1,
          height: 32,
          padding: collapsed ? '0' : '0 10px',
          background: 'var(--amber)',
          color: '#06060a',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          transition: 'opacity var(--transition-fast)',
        }}
      >
        <Pencil size={collapsed ? 18 : 14} />
        {!collapsed && <span>Compose</span>}
      </button>
      {onSync && (
        <button
          onClick={onSync}
          disabled={syncing}
          title="Sync emails"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: syncing ? 'not-allowed' : 'pointer',
            transition: 'opacity var(--transition-fast)',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={14} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      )}
    </div>
  );

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: collapsed ? '12px 6px' : '12px',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Compose button */}
      <div style={{ marginBottom: 8 }}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{composeButton}</TooltipTrigger>
            <TooltipContent side="right">Compose</TooltipContent>
          </Tooltip>
        ) : (
          composeButton
        )}
      </div>

      {/* All / unified inbox */}
      <MailSidebarItem
        icon={<Mail size={18} />}
        label="All"
        count={totalUnread}
        total={totalEnEntrada}
        active={activeAccount === null}
        collapsed={collapsed}
        onClick={() => onAccountChange(null)}
      />

      {/* Accounts section */}
      {accounts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 12px',
                marginBottom: 2,
              }}
            >
              Accounts
            </div>
          )}
          {accounts.map((acc) => {
            const displayName = renames[acc.id] || acc.name;

            if (renamingId === acc.id) {
              return (
                <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', height: 32 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: acc.color, flexShrink: 0 }} />
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={commitRename}
                    style={{
                      flex: 1,
                      background: 'var(--surface)',
                      border: '1px solid var(--amber)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-sans)',
                      padding: '2px 6px',
                      height: 24,
                      outline: 'none',
                    }}
                  />
                </div>
              );
            }

            return (
              <ContextMenu key={acc.id} items={getAccountMenuItems(acc)} trigger={
                <MailSidebarItem
                  icon={
                    <EntitySource entity={acc} domain="mail" />
                  }
                  label={displayName}
                  count={porCuenta[acc.id]?.unread}
                  total={porCuenta[acc.id]?.total}
                  active={activeAccount === acc.id}
                  collapsed={collapsed}
                  onClick={() => onAccountChange(acc.id)}
                  colorDot={acc.color}
                />
              } />
            );
          })}
        </div>
      )}

      {/* Folders section */}
      <div style={{ marginTop: 12 }}>
        {!collapsed && (
          <div
            style={{
              fontSize: '0.625rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '4px 12px',
              marginBottom: 2,
            }}
          >
            Folders
          </div>
        )}
        {FOLDERS.map((folder) => {
          const FolderIcon = folder.icon;
          return (
            <MailSidebarItem
              key={folder.key}
              icon={<FolderIcon size={18} />}
              label={folder.label}
              count={folderUnread[folder.key]}
              total={folderTotal[folder.key]}
              active={!activeLabel && activeFolder === folder.key}
              collapsed={collapsed}
              onClick={() => onFolderChange(folder.key)}
            />
          );
        })}

        {/* The provider's own folders, under the account they came from. If the
            wizard let you tick 12 folders, all 12 have to be reachable. */}
        {customByAccount.map(([accountId, folders]) => (
          <div key={accountId ?? 'sin-cuenta'} style={{ marginTop: 8 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-muted)',
                  padding: '4px 12px',
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={accounts.find((a) => a.id === accountId)?.email_address ?? undefined}
              >
                {accounts.find((a) => a.id === accountId)?.email_address ?? 'Other'}
              </div>
            )}
            {folders.map((row) => (
              <MailSidebarItem
                key={`${accountId ?? 'x'}:${row.folder}`}
                icon={<Folder size={18} />}
                label={row.folder}
                count={row.unread}
                total={row.total}
                active={!activeLabel && activeFolder === row.folder}
                collapsed={collapsed}
                onClick={() => onFolderChange(row.folder)}
              />
            ))}
          </div>
        ))}

        {/* Las etiquetas de Gmail. Una etiqueta atraviesa Entrada, Enviados y
            Archivo, así que se muestra aparte de las carpetas y las excluye. */}
        {labelsByAccount.map(([accountId, rows]) => (
          <div key={`labels:${accountId ?? 'sin-cuenta'}`} style={{ marginTop: 8 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-muted)',
                  padding: '4px 12px',
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={accounts.find((a) => a.id === accountId)?.email_address ?? undefined}
              >
                Labels · {accounts.find((a) => a.id === accountId)?.email_address ?? 'Other'}
              </div>
            )}
            {rows.map((row) => (
              <MailSidebarItem
                key={`${accountId ?? 'x'}:label:${row.label}`}
                icon={<Tag size={18} />}
                label={row.label}
                count={row.unread}
                total={row.total}
                active={activeLabel === row.label}
                collapsed={collapsed}
                onClick={() => onLabelChange?.(activeLabel === row.label ? null : row.label)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Export button */}
      {!collapsed && onExport && (
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setExportOpen(true)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              height: 32,
              padding: '4px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              transition: 'background var(--transition-fast)',
            }}
          >
            <Download size={16} />
            Export emails
          </button>
        </div>
      )}

      {/* Color picker popup */}
      {colorPickerTarget && (
        <>
          <div
            onClick={() => setColorPickerTarget(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' as any }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 'var(--z-dropdown)' as any,
              background: 'var(--glass-95)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
              Pick a color
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {ACCOUNT_COLORS.map((c) => {
                const currentColor = accounts.find(a => a.id === colorPickerTarget)?.color;
                const isActive = c.value === currentColor;
                return (
                  <button
                    key={c.value}
                    title={c.name}
                    onClick={() => {
                      onChangeAccountColor?.(colorPickerTarget, c.value);
                      setColorPickerTarget(null);
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-full)',
                      background: c.value,
                      border: isActive ? '2px solid var(--text)' : '2px solid transparent',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'transform 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Export modal */}
      {exportOpen && (
        <>
          <div
            onClick={() => setExportOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal-backdrop)' as any, background: 'rgba(0,0,0,0.4)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 'var(--z-modal)' as any,
              width: 320,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              boxShadow: 'var(--shadow-lg)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Export emails
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              {activeAccount
                ? `Account: ${renames[activeAccount] || accounts.find(a => a.id === activeAccount)?.name || 'Selected'}`
                : 'All accounts'}
            </div>

            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Folders to export
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {FOLDERS.map((f) => (
                <label
                  key={f.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    color: 'var(--text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={exportFolders.has(f.key)}
                    onChange={() => toggleExportFolder(f.key)}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  {f.label}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setExportOpen(false)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExportConfirm}
                disabled={exportFolders.size === 0}
                style={{
                  padding: '6px 14px',
                  background: exportFolders.size > 0 ? 'var(--amber)' : 'var(--surface-hover)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: exportFolders.size > 0 ? '#06060a' : 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: exportFolders.size > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Export CSV
              </button>
            </div>
          </div>
        </>
      )}
      {/* El mismo botón que llevan los otros ocho módulos: abre el asistente
          saltándose la primera ventana, porque el tipo de dato ya lo dice el
          sitio desde el que se pulsa. */}
      <ConnectButton dataType="mail" />
    </nav>
  );
}
