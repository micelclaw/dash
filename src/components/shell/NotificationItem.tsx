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

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Bot, Mail, BarChart3, AlertTriangle, ShieldCheck, Shield, Zap, Calendar, Users, MessageCircle, Check, X, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Notification } from '@/types/notifications';
import { useNotificationStore } from '@/stores/notification.store';
import { useDigestStore } from '@/stores/digest.store';
import { useSecurityStore } from '@/stores/security.store';

const TYPE_ICONS: Record<Notification['type'], LucideIcon> = {
  sync: RefreshCw,
  agent_action: Bot,
  email: Mail,
  calendar: Calendar,
  contacts: Users,
  digest: BarChart3,
  system: AlertTriangle,
  security: Shield,
  approval: ShieldCheck,
  change: Zap,
  messages: MessageCircle,
};

const TYPE_COLORS: Record<Notification['type'], string> = {
  sync: 'var(--info)',
  agent_action: 'var(--mod-agents)',
  email: 'var(--mod-mail)',
  calendar: 'var(--mod-calendar)',
  contacts: 'var(--mod-contacts)',
  digest: 'var(--mod-chat)',
  system: 'var(--warning)',
  security: 'var(--error)',
  approval: 'var(--error)',
  change: 'var(--success)',
  messages: 'var(--mod-chat)',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

/** ✓ / ✗ para resolver una aprobación sin salir del panel. */
function ResolveButton({
  kind, busy, disabled, onClick,
}: {
  kind: 'approve' | 'reject';
  busy: boolean;
  disabled: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const color = kind === 'approve' ? 'var(--success)' : 'var(--error)';
  const Glyph = busy ? Loader2 : kind === 'approve' ? Check : X;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={kind === 'approve' ? 'Aprobar' : 'Denegar'}
      aria-label={kind === 'approve' ? 'Aprobar' : 'Denegar'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        color,
        background: 'none',
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled && !busy ? 0.4 : 1,
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = `color-mix(in srgb, ${color} 15%, transparent)`;
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <Glyph size={13} className={busy ? 'animate-spin' : undefined} />
    </button>
  );
}

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const navigate = useNavigate();
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  // Resolver una aprobación desde la propia notificación. Solo si el SERVIDOR la marcó
  // `actionable` (las L3 piden PIN → esas se resuelven en su tarjeta, con "Ver").
  const approvalRef =
    notification.ref?.kind === 'approval' && notification.ref.actionable
      ? notification.ref
      : null;
  const [resolving, setResolving] = useState<'approve' | 'reject' | null>(null);
  const approveApproval = useSecurityStore((s) => s.approveApproval);
  const rejectApproval = useSecurityStore((s) => s.rejectApproval);
  const removeByRef = useNotificationStore((s) => s.removeByRef);

  const Icon = TYPE_ICONS[notification.type];
  const iconColor = notification.color ?? TYPE_COLORS[notification.type];

  const dispatchAction = () => {
    if (notification.action?.callback === 'openBriefing') {
      useDigestStore.getState().setPanelOpen(true);
      onClose();
      return true;
    }
    if (notification.action?.route) {
      navigate(notification.action.route);
      onClose();
      return true;
    }
    return false;
  };

  const handleClick = () => {
    markAsRead(notification.id);
    dispatchAction();
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(notification.id);
    dispatchAction();
  };

  const handleResolve = async (e: React.MouseEvent, decision: 'approve' | 'reject') => {
    e.stopPropagation(); // no navegar a /approvals: la acción ocurre AQUÍ
    if (!approvalRef || resolving) return;
    setResolving(decision);
    try {
      if (decision === 'approve') await approveApproval(approvalRef.id);
      else await rejectApproval(approvalRef.id);
      // La retirada real la ordena el servidor (`notification.dismiss`) para que se vaya
      // de TODAS las pestañas y del móvil; esto solo evita el parpadeo en la nuestra.
      removeByRef(approvalRef.kind, approvalRef.id);
    } catch (err: unknown) {
      setResolving(null);
      const code =
        (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      if (code === 'CREDENTIAL_REQUIRED' || code === 'PIN_REQUIRED') {
        // Salvaguarda: el servidor manda. Si exige credencial pese a `actionable`,
        // no insistimos aquí — se resuelve donde se puede introducir el PIN.
        toast.info('Esta aprobación pide tu PIN', { description: 'Ábrela para confirmarla.' });
        navigate('/approvals');
        onClose();
        return;
      }
      toast.error(decision === 'approve' ? 'No se pudo aprobar' : 'No se pudo denegar', {
        description: 'Inténtalo desde la página de aprobaciones.',
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 12px',
        cursor: (notification.action?.route || notification.action?.callback) ? 'pointer' : 'default',
        borderLeft: notification.read ? '2px solid transparent' : '2px solid var(--amber)',
        opacity: notification.read ? 0.6 : 1,
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} style={{ color: iconColor, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.4 }}>
          {notification.title}
        </div>
        {notification.body && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.3 }}>
            {notification.body}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {timeAgo(notification.timestamp)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {approvalRef && (
              <>
                <ResolveButton
                  kind="approve"
                  busy={resolving === 'approve'}
                  disabled={resolving !== null}
                  onClick={(e) => void handleResolve(e, 'approve')}
                />
                <ResolveButton
                  kind="reject"
                  busy={resolving === 'reject'}
                  disabled={resolving !== null}
                  onClick={(e) => void handleResolve(e, 'reject')}
                />
              </>
            )}
            {notification.action && (
              <button
                onClick={handleActionClick}
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--amber)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--amber-dim)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                {notification.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
