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

import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search, Newspaper, Network, Power, RotateCcw, Settings, LogOut } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { ClipboardButton } from './ClipboardButton';
import { BriefingPanel } from '@/components/BriefingPanel';
import { GraphViewModal } from '@/components/graph/GraphViewModal';
import { ProUpsellModal } from '@/components/shared/ProUpsellModal';
import { useDigestStore } from '@/stores/digest.store';
import { MODULES } from '@/config/modules';
import { useAuthStore } from '@/stores/auth.store';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { lucideLookup } from '@/config/lucide-lookup';
import { useIsPhone } from '@/hooks/use-media-query';
import { hasNativeNotify } from '@/lib/native-notify';
import { hasNativeAccessReset, nativeResetAccess } from '@/lib/native-session';
import { settingsRouteForPath } from '@/config/settings-route-map';
import { api } from '@/services/api';

/**
 * Menú de sesión y servidor.
 *
 * "Sign out" vive AQUÍ y no solo en el pie del panel lateral porque ese panel no existe
 * en el teléfono: en la app era literalmente inalcanzable. Y en la app cerrar sesión
 * tiene que soltar además el acceso del dispositivo (`nativeResetAccess`), o al reabrir
 * la app volvería a entrar sola con el emparejamiento y no habría forma de repetir el
 * proceso de conexión.
 */
function PowerMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<'shutdown' | 'restart' | 'signout' | null>(null);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const inApp = hasNativeAccessReset();

  const handleSignOut = () => {
    if (confirming !== 'signout') {
      setConfirming('signout');
      return;
    }
    // La sesión del dash es lo único que vive en ESTE origen: se limpia siempre.
    logout();
    // En la app, el envoltorio suelta el acceso y navega al onboarding él mismo.
    if (!nativeResetAccess()) navigate('/login', { replace: true });
    setOpen(false);
    setConfirming(null);
  };

  const handleAction = async (action: 'shutdown' | 'restart') => {
    if (confirming !== action) {
      setConfirming(action);
      return;
    }
    try {
      const endpoint = action === 'shutdown' ? '/hal/core/shutdown' : '/hal/core/restart';
      await api.post(endpoint);
    } catch {
      // Server may drop before responding
    }
    setOpen(false);
    setConfirming(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); setConfirming(null); }}
        title={inApp ? "Session & server" : "Session & server power"}
        style={{
          background: 'none', border: 'none',
          cursor: 'pointer', color: open ? 'var(--amber)' : 'var(--text-dim)',
          padding: 4, display: 'flex',
        }}
      >
        <Power size={18} />
      </button>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => { setOpen(false); setConfirming(null); }}
          />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            background: '#1a1a24', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: 4,
            zIndex: 200, minWidth: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            <button
              onClick={handleSignOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px',
                background: confirming === 'signout' ? 'rgba(239,68,68,0.15)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: confirming === 'signout' ? 'var(--error)' : 'var(--text)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (confirming !== 'signout') e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { if (confirming !== 'signout') e.currentTarget.style.background = 'transparent'; }}
              data-testid="power-signout"
            >
              <LogOut size={14} />
              {confirming === 'signout'
                ? (inApp ? 'Click to confirm — back to connection setup' : 'Click to confirm')
                : (inApp ? 'Sign out & reconnect' : 'Sign out')}
            </button>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
            <button
              onClick={() => handleAction('restart')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px',
                background: confirming === 'restart' ? 'rgba(245,158,11,0.15)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: confirming === 'restart' ? 'var(--amber)' : 'var(--text)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (confirming !== 'restart') e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { if (confirming !== 'restart') e.currentTarget.style.background = 'transparent'; }}
            >
              <RotateCcw size={14} />
              {confirming === 'restart' ? 'Click to confirm' : 'Restart Server'}
            </button>
            <button
              onClick={() => handleAction('shutdown')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px',
                background: confirming === 'shutdown' ? 'rgba(239,68,68,0.15)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: confirming === 'shutdown' ? 'var(--error)' : 'var(--text)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (confirming !== 'shutdown') e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={(e) => { if (confirming !== 'shutdown') e.currentTarget.style.background = 'transparent'; }}
            >
              <Power size={14} />
              {confirming === 'shutdown' ? 'Click to confirm' : 'Shutdown Server'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BriefingButton() {
  const unreadCount = useDigestStore((s) => s.unreadCount);
  const panelOpen = useDigestStore((s) => s.panelOpen);
  const setPanelOpen = useDigestStore((s) => s.setPanelOpen);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        style={{
          position: 'relative',
          background: 'none', border: 'none',
          cursor: 'pointer', color: panelOpen ? 'var(--amber)' : 'var(--text-dim)',
          padding: 4, display: 'flex',
        }}
      >
        <Newspaper size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -4,
            minWidth: 14, height: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--amber)', color: '#06060a',
            borderRadius: 7, fontSize: '0.5625rem',
            fontWeight: 700, fontFamily: 'var(--font-sans)',
            padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <BriefingPanel />
    </div>
  );
}

interface TopBarProps {
  onOpenCommandPalette: () => void;
}

export function TopBar({ onOpenCommandPalette }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  // Any paid tier (pro OR plus) unlocks Pro features; only 'free' is gated.
  const isPro = useAuthStore((s) => s.user)?.tier !== 'free';
  // En la app móvil el buscador central tapaba el título del módulo → se oculta.
  // La búsqueda sigue accesible desde la bottom-nav (slot Buscar) y ⌘K.
  const isPhone = useIsPhone();
  const [graphOpen, setGraphOpen] = useState(false);
  const [centerEntityId, setCenterEntityId] = useState<string | undefined>();
  const [upsellOpen, setUpsellOpen] = useState(false);

  // Listen for open-graph events from GraphProximityPanel
  const handleOpenGraph = useCallback((e: Event) => {
    const entityId = (e as CustomEvent<{ entityId: string }>).detail?.entityId;
    setCenterEntityId(entityId);
    setGraphOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('open-graph', handleOpenGraph);
    return () => window.removeEventListener('open-graph', handleOpenGraph);
  }, [handleOpenGraph]);

  const currentModule = MODULES.find((m) => m.path && location.pathname.startsWith(m.path));

  // Los módulos L3 dinámicos (apps embebidas vía MicelHub) viven en /app/:appName
  // y NO están en el registro estático MODULES → sin esto la barra mostraría
  // "Micelclaw" sin icono. Los resolvemos contra el ui-modules store (label +
  // icono Lucide + color de la propia app, ej. n8n).
  const uiModules = useUiModulesStore((s) => s.modules);
  const appName = location.pathname.match(/^\/app\/([^/]+)/)?.[1];
  const appMod = appName ? uiModules.find((m) => m.app_name === decodeURIComponent(appName)) : undefined;

  const moduleLabel = currentModule?.label ?? appMod?.label ?? 'Micelclaw';
  const moduleColor = currentModule?.color ?? appMod?.color ?? undefined;
  const ModIcon = currentModule?.icon ?? (appMod ? lucideLookup(appMod.icon) : undefined);

  return (
    <div
      style={{
        // Altura fija + inset de safe-area arriba: en el APK móvil (barra de estado
        // oculta/edge-to-edge) despeja el recorte de cámara y la barra transitoria
        // al deslizar; en web/PWA/escritorio env()=0 → altura 42. Bajada de 48→42
        // para eliminar el aire contra la hora/batería (bug 1); el 'top' fixed de
        // los paneles desplegables usa este mismo 42px.
        height: 'calc(42px + env(safe-area-inset-top, 0px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 0,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* Left zone (en móvil la navegación vive en la bottom-nav — sin hamburguesa) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {ModIcon && (
          <ModIcon size={18} style={{ color: moduleColor, flexShrink: 0 }} />
        )}
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {moduleLabel}
        </h2>
      </div>

      {/* Center — search button (oculto en la app móvil: tapaba el título) */}
      {!isPhone && (
      <button
        onClick={onOpenCommandPalette}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 12px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          transition: 'background var(--transition-fast), border-color var(--transition-fast)',
          maxWidth: 320,
          flex: '0 1 320px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--card)';
          e.currentTarget.style.borderColor = 'var(--border-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <Search size={14} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
        <kbd
          style={{
            fontSize: '0.6875rem',
            padding: '1px 5px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}
        >
          ⌘K
        </kbd>
      </button>
      )}

      {/* Right zone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => isPro ? setGraphOpen(true) : setUpsellOpen(true)}
          title="Knowledge Graph"
          style={{
            background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-dim)',
            padding: 4, display: 'flex',
          }}
        >
          <Network size={18} />
        </button>
        <ClipboardButton />
        <BriefingButton />
        {/* En la app nativa (APK) la campana NO existe: las notificaciones se
            entregan como notificaciones NATIVAS de Android. En escritorio/PWA/
            navegador se mantiene (esos no tienen entrega nativa). */}
        {!hasNativeNotify() && <NotificationBell />}
        {/* Engranaje contextual: lleva a la sección de Ajustes del módulo actual
            (p.ej. Mail → /settings/mail), o a los Ajustes generales si el módulo
            no tiene sección propia. Misma derivación que el gear de la bottom-nav
            móvil (settings-route-map). Oculto en móvil: ahí ya vive en la bottom-nav. */}
        {!isPhone && (
          <button
            onClick={() => navigate(settingsRouteForPath(location.pathname))}
            title="Ajustes del módulo"
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer',
              color: location.pathname.startsWith('/settings') ? 'var(--amber)' : 'var(--text-dim)',
              padding: 4, display: 'flex',
            }}
          >
            <Settings size={18} />
          </button>
        )}
        <PowerMenu />
      </div>

      {/* Graph View Modal (Pro) */}
      <GraphViewModal open={graphOpen} onClose={() => { setGraphOpen(false); setCenterEntityId(undefined); }} centerEntityId={centerEntityId} />

      {/* Upsell Modal (Free) */}
      {upsellOpen && (
        <ProUpsellModal
          feature="Knowledge Graph"
          description="Explore entities and connections discovered by AI across your records."
          onClose={() => setUpsellOpen(false)}
        />
      )}
    </div>
  );
}
