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

import { useNavigate } from 'react-router';
import { BarChart3, ExternalLink } from 'lucide-react';

export function RotkiCard() {
  const navigate = useNavigate();

  return (
    <div className="crypto-card">
      <div className="crypto-card-header">
        <div className="crypto-card-dot" style={{ background: '#6b7280' }} />
        <BarChart3 size={14} style={{ color: '#7e5bef' }} />
        <span className="crypto-card-title">Rotki — Portfolio Tracker</span>
        <div style={{ flex: 1 }} />
        <button className="crypto-btn-sm" onClick={() => navigate('/crypto/rotki')} title="Open Rotki">
          <ExternalLink size={12} />
        </button>
      </div>

      <div className="crypto-card-body">
        <div className="rotki-summary">
          <span className="rotki-label">Total portfolio value</span>
          <span className="rotki-value">— €</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Not installed
        </div>
      </div>

      <style>{`
        .rotki-summary { display: flex; align-items: baseline; gap: 8px; }
        .rotki-label { font-size: 11px; color: var(--text-muted); }
        .rotki-value { font-size: 15px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}
