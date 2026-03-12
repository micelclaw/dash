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
import { Loader2, Play, Square, Cpu, AlertTriangle } from 'lucide-react';
import { useMoneroRpc } from '../hooks/useMoneroRpc';

interface MiningStatus {
  active: boolean;
  speed: number;
  threads_count: number;
  address: string;
  is_background_mining_enabled: boolean;
}

export function MiningTab() {
  const rpc = useMoneroRpc();
  const { call } = rpc;
  const [status, setStatus] = useState<MiningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Config
  const [threads, setThreads] = useState(1);
  const [bgMining, setBgMining] = useState(false);
  const [ignoreBattery, setIgnoreBattery] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const result = await call<MiningStatus>('get_mining_status', {});
    if (result) {
      setStatus(result);
      if (result.active) {
        setThreads(result.threads_count);
        setBgMining(result.is_background_mining_enabled);
      }
    }
    setLoading(false);
  }, [call]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Poll status while mining
  useEffect(() => {
    if (!status?.active) return;
    const iv = setInterval(fetchStatus, 10000);
    return () => clearInterval(iv);
  }, [status?.active, fetchStatus]);

  const startMining = useCallback(async () => {
    setToggling(true);
    await call('start_mining', {
      threads_count: threads,
      do_background_mining: bgMining,
      ignore_battery: ignoreBattery,
    });
    await fetchStatus();
    setToggling(false);
  }, [call, threads, bgMining, ignoreBattery, fetchStatus]);

  const stopMining = useCallback(async () => {
    setToggling(true);
    await call('stop_mining', {});
    await fetchStatus();
    setToggling(false);
  }, [call, fetchStatus]);

  const cpuCount = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Checking mining status...
      </div>
    );
  }

  return (
    <div className="mn-root">
      <h3 className="mn-title">Mining</h3>

      {/* Warning */}
      <div className="mn-warning">
        <AlertTriangle size={13} />
        <span>Solo mining on mainnet is extremely unlikely to find a block. This is primarily useful for testnet/stagenet or contributing hashrate to the network.</span>
      </div>

      {/* Status card */}
      <div className={`mn-status-card ${status?.active ? 'mn-status-active' : ''}`}>
        <div className="mn-status-icon">
          <Cpu size={20} />
        </div>
        <div className="mn-status-info">
          <div className="mn-status-label">{status?.active ? 'Mining Active' : 'Mining Inactive'}</div>
          {status?.active && (
            <div className="mn-status-details">
              <span>{status.threads_count} thread{status.threads_count !== 1 ? 's' : ''}</span>
              {status.speed > 0 && <span>{status.speed.toFixed(1)} H/s</span>}
              {status.is_background_mining_enabled && <span>Background</span>}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {status?.active ? (
          <button className="mn-toggle-btn mn-toggle-stop" onClick={stopMining} disabled={toggling}>
            {toggling ? <Loader2 size={13} className="spin" /> : <Square size={13} />}
            Stop
          </button>
        ) : (
          <button className="mn-toggle-btn mn-toggle-start" onClick={startMining} disabled={toggling}>
            {toggling ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            Start
          </button>
        )}
      </div>

      {/* Config (only when not mining) */}
      {!status?.active && (
        <div className="mn-config">
          <div className="mn-config-title">Configuration</div>

          <div className="mn-field">
            <label className="mn-label">Threads</label>
            <div className="mn-threads-row">
              <input
                className="mn-input"
                type="range"
                min={1}
                max={cpuCount}
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value))}
              />
              <span className="mn-threads-val">{threads} / {cpuCount}</span>
            </div>
          </div>

          <div className="mn-field">
            <label className="mn-check">
              <input type="checkbox" checked={bgMining} onChange={(e) => setBgMining(e.target.checked)} />
              Background mining
            </label>
            <div className="mn-field-hint">Mine only when the system is idle</div>
          </div>

          <div className="mn-field">
            <label className="mn-check">
              <input type="checkbox" checked={ignoreBattery} onChange={(e) => setIgnoreBattery(e.target.checked)} />
              Ignore battery
            </label>
            <div className="mn-field-hint">Continue mining even when on battery power</div>
          </div>
        </div>
      )}

      <style>{`
        .mn-root { max-width: 560px; }
        .mn-title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 16px; }

        .mn-warning { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2); border-radius: var(--radius-sm); color: #f59e0b; font-size: 11px; line-height: 1.4; margin-bottom: 16px; }

        .mn-status-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 20px; }
        .mn-status-active { border-color: rgba(34,197,94,0.3); }
        .mn-status-icon { color: var(--text-muted); }
        .mn-status-active .mn-status-icon { color: #22c55e; }
        .mn-status-label { font-size: 14px; font-weight: 500; color: var(--text); }
        .mn-status-details { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); margin-top: 2px; }

        .mn-toggle-btn { display: flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: var(--radius-sm); font-size: 12px; font-family: var(--font-sans); cursor: pointer; border: none; }
        .mn-toggle-btn:disabled { opacity: 0.5; }
        .mn-toggle-start { background: #22c55e; color: white; }
        .mn-toggle-start:hover:not(:disabled) { background: #16a34a; }
        .mn-toggle-stop { background: #ef4444; color: white; }
        .mn-toggle-stop:hover:not(:disabled) { background: #dc2626; }

        .mn-config { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; }
        .mn-config-title { font-size: 12px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }

        .mn-field { margin-bottom: 14px; }
        .mn-field:last-child { margin-bottom: 0; }
        .mn-label { display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px; }
        .mn-field-hint { font-size: 11px; color: var(--text-muted); margin-top: 2px; margin-left: 22px; }

        .mn-threads-row { display: flex; align-items: center; gap: 10px; }
        .mn-input { flex: 1; accent-color: #ff6600; }
        .mn-threads-val { font-size: 12px; color: var(--text); font-variant-numeric: tabular-nums; min-width: 50px; }

        .mn-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
        .mn-check input { accent-color: #ff6600; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
