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

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Sparkles, ChevronDown, Boxes, AlignLeft, CalendarPlus, PenLine, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { ApiListResponse } from '@/types/api';

interface InventoryProposalRow {
  id: string;
  payload: {
    name: string;
    purchase_price?: number;
    [key: string]: unknown;
  };
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  textAlign: 'left',
};

function SoonBadge() {
  return (
    <span
      style={{
        fontSize: '0.625rem',
        background: 'var(--surface)',
        borderRadius: 999,
        padding: '1px 6px',
        color: 'var(--text-dim)',
        marginLeft: 'auto',
      }}
    >
      soon
    </span>
  );
}

export function MailAIActionsMenu({ emailId }: { emailId: string }) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleAnalyzeInventory = async () => {
    setOpen(false);
    setAnalyzing(true);
    try {
      await api.post('/inventory/proposals/from-email', { email_id: emailId });
      toast.success('Analyzing locally — you will get a notification with the proposals');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to analyze email');
    }
    // Visual analyzing state ~4s (backend responds 202 and notifies via the bell)
    setTimeout(() => setAnalyzing(false), 4000);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        AI
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 4,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 'var(--z-dropdown, 50)' as unknown as number,
            minWidth: 230,
            padding: '4px 0',
          }}
        >
          <button
            onClick={handleAnalyzeInventory}
            style={itemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Boxes size={14} /> Analyze for Inventory
          </button>
          <button disabled style={{ ...itemStyle, color: 'var(--text-muted)', cursor: 'not-allowed' }}>
            <AlignLeft size={14} /> Summarize <SoonBadge />
          </button>
          <button disabled style={{ ...itemStyle, color: 'var(--text-muted)', cursor: 'not-allowed' }}>
            <CalendarPlus size={14} /> Extract event <SoonBadge />
          </button>
          <button disabled style={{ ...itemStyle, color: 'var(--text-muted)', cursor: 'not-allowed' }}>
            <PenLine size={14} /> Draft reply <SoonBadge />
          </button>
        </div>
      )}
    </div>
  );
}

export function InventoryProposalsBanner({ emailId }: { emailId: string }) {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<InventoryProposalRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.get<ApiListResponse<InventoryProposalRow>>('/inventory/proposals', {
      status: 'pending',
      source: 'email',
      source_ref: emailId,
    })
      .then(res => {
        if (!cancelled) setProposals(res.data ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [emailId]);

  if (proposals.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--mod-inventory)',
        background: 'var(--card)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        margin: '12px 0',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Boxes size={16} style={{ color: 'var(--mod-inventory)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 600 }}>
          {proposals.length} item{proposals.length !== 1 ? 's' : ''} proposed for your inventory
        </div>
        {proposals.slice(0, 3).map(p => (
          <div
            key={p.id}
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.payload.name}
            {p.payload.purchase_price != null ? ` — ${p.payload.purchase_price}` : ''}
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate('/inventory?tab=panel')}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-sans)',
          padding: '4px 10px',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        Review →
      </button>
    </div>
  );
}
