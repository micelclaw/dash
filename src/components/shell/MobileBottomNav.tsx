/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

// Barra de navegación inferior del shell móvil (sustituye al panel lateral):
// Hoy · Chat · [+] captura · Buscar · Más. El FAB central "+" abre la captura
// (cámara). "Más" abre el grid de todos los módulos.
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, MessageSquare, Search, LayoutGrid, Plus } from 'lucide-react';
import { MobileMoreSheet } from './MobileMoreSheet';
import { CaptureSheet } from './CaptureSheet';

const SLOTS = [
  { id: 'today', label: 'Hoy', icon: Home, path: '/' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
  { id: 'search', label: 'Buscar', icon: Search, path: '/search' },
  { id: 'more', label: 'Más', icon: LayoutGrid, path: '__more' },
] as const;

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');

  const Slot = ({ id, label, icon: Icon, path }: (typeof SLOTS)[number]) => {
    const active = path !== '__more' && isActive(path);
    return (
      <button
        onClick={() => (path === '__more' ? setMoreOpen(true) : navigate(path))}
        data-testid={`nav-${id}`}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0',
          color: active ? 'var(--amber)' : 'var(--text-muted)', minWidth: 0,
        }}>
        <Icon size={20} />
        <span style={{ fontSize: '0.62rem', fontWeight: active ? 600 : 400 }}>{label}</span>
      </button>
    );
  };

  return (
    <>
      <nav
        data-testid="mobile-bottom-nav"
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', position: 'relative',
          height: 'calc(56px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
        }}>
        <Slot {...SLOTS[0]} />
        <Slot {...SLOTS[1]} />
        {/* FAB central "+" */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setCaptureOpen(true)}
            data-testid="nav-capture"
            aria-label="Capturar"
            style={{
              width: 52, height: 52, marginTop: -18, borderRadius: '50%', border: '3px solid var(--bg)',
              background: 'var(--amber)', color: '#1a1a1a', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-lg)',
            }}>
            <Plus size={26} />
          </button>
        </div>
        <Slot {...SLOTS[2]} />
        <Slot {...SLOTS[3]} />
      </nav>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
      <CaptureSheet open={captureOpen} onOpenChange={setCaptureOpen} />
    </>
  );
}
