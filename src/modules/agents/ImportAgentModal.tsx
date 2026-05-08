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

import { useState, useCallback, useRef } from 'react';
import { Loader2, Package, Upload, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  validateAgentarPackage,
  installAgentarPackage,
  type AgentarValidationResult,
  type AgentarInstallResult,
} from '@/services/agentar.service';

interface ImportAgentModalProps {
  onClose: () => void;
  onInstalled: (result: AgentarInstallResult) => void;
}

type Step = 'drop' | 'review' | 'done';

export function ImportAgentModal({ onClose, onInstalled }: ImportAgentModalProps) {
  const [step, setStep] = useState<Step>('drop');
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [validation, setValidation] = useState<AgentarValidationResult | null>(null);
  const [installResult, setInstallResult] = useState<AgentarInstallResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(async (f: File) => {
    setFile(f);
    setValidating(true);
    try {
      const result = await validateAgentarPackage(f);
      setValidation(result);
      setStep('review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
      setFile(null);
    } finally {
      setValidating(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, [acceptFile]);

  const handleInstall = useCallback(async () => {
    if (!file) return;
    setInstalling(true);
    try {
      const result = await installAgentarPackage(file);
      setInstallResult(result);
      onInstalled(result);
      setStep('done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
    }
  }, [file, onInstalled]);

  return (
    <div
      onClick={() => !installing && !validating && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24,
          maxWidth: 540, width: '92vw', maxHeight: '85vh', overflowY: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={18} /> Import agent
          </h2>
          <button
            onClick={onClose}
            disabled={validating || installing}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {step === 'drop' && (
          <DropStep
            dragging={dragging}
            validating={validating}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onBrowse={() => fileInputRef.current?.click()}
          />
        )}

        {step === 'review' && validation && (
          <ReviewStep
            validation={validation}
            installing={installing}
            onBack={() => { setStep('drop'); setFile(null); setValidation(null); }}
            onInstall={handleInstall}
          />
        )}

        {step === 'done' && installResult && (
          <DoneStep result={installResult} onClose={onClose} />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".tar.gz,.tgz,.claw-agent,application/gzip,application/x-tar"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) acceptFile(f);
          }}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

function DropStep({
  dragging, validating, onDragEnter, onDragLeave, onDrop, onBrowse,
}: {
  dragging: boolean;
  validating: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
}) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? 'var(--amber)' : 'var(--border)'}`,
        background: dragging ? 'var(--amber-dim)' : 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 24px',
        textAlign: 'center',
        transition: 'var(--transition-fast)',
      }}
    >
      {validating ? (
        <>
          <Loader2 size={32} style={{ color: 'var(--amber)', margin: '0 auto', display: 'block', animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: '12px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Validating package…</p>
        </>
      ) : (
        <>
          <Upload size={32} style={{ color: 'var(--text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ margin: '12px 0 4px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            Drop a .claw-agent or .tar.gz file
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            or{' '}
            <button
              onClick={onBrowse}
              style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
            >
              browse
            </button>
          </p>
        </>
      )}
    </div>
  );
}

function ReviewStep({
  validation, installing, onBack, onInstall,
}: {
  validation: AgentarValidationResult;
  installing: boolean;
  onBack: () => void;
  onInstall: () => void;
}) {
  const m = validation.manifest;
  const errors = validation.issues.filter(i => i.level === 'error');
  const warnings = validation.issues.filter(i => i.level === 'warning' && i.code !== 'MISSING_SKILL');

  return (
    <div>
      {/* Manifest summary */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.25rem' }}>{m.avatar || '🤖'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              {m.display_name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>v{m.version}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <code style={{ fontFamily: 'var(--font-mono)' }}>{m.name}</code>
              {m.role && <> — {m.role}</>}
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.6875rem', fontWeight: 600,
            color: validation.valid ? 'var(--success)' : 'var(--error)',
            background: validation.valid ? 'var(--success-dim, rgba(34,197,94,0.15))' : 'rgba(239,68,68,0.15)',
            padding: '3px 10px', borderRadius: 'var(--radius-full)',
          }}>
            {validation.valid ? <><CheckCircle2 size={12} /> valid</> : <><AlertTriangle size={12} /> invalid</>}
          </span>
        </div>
        {m.description && (
          <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {m.description}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, fontSize: '0.75rem' }}>
          <Row label="Model" value={m.model || '—'} />
          <Row label="Scopes" value={m.scopes.length > 0 ? m.scopes.join(', ') : '—'} />
          <Row
            label="Skills"
            value={`${m.skills.length} declared (${validation.embedded_skills.length} bundled, ${validation.missing_skills.length} missing)`}
          />
          <Row label="Files in package" value={String(validation.file_count)} />
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Banner kind="error" title="Validation errors">
          {errors.map((e, i) => (
            <div key={i}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>{e.code}</code> {e.message}
            </div>
          ))}
        </Banner>
      )}

      {/* Missing skills */}
      {validation.missing_skills.length > 0 && (
        <Banner kind="warning" title="Missing skills">
          <p style={{ margin: '0 0 6px', fontSize: '0.75rem' }}>
            These skills are declared but not installed on this system. Install them from MicelHub, then restart the agent:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.75rem' }}>
            {validation.missing_skills.map(s => (
              <li key={s}><code style={{ fontFamily: 'var(--font-mono)' }}>{s}</code></li>
            ))}
          </ul>
        </Banner>
      )}

      {/* Other warnings */}
      {warnings.length > 0 && (
        <Banner kind="warning" title="Warnings">
          {warnings.map((w, i) => (
            <div key={i}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>{w.code}</code> {w.message}
            </div>
          ))}
        </Banner>
      )}

      <Banner kind="info" title="USER.md will be reset">
        Personal data from the source workspace was sanitized — your chief will refill it during the new agent's bootstrap.
      </Banner>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button
          onClick={onBack}
          disabled={installing}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            cursor: installing ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
          }}
        >Back</button>
        <button
          onClick={onInstall}
          disabled={!validation.valid || installing}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            cursor: !validation.valid || installing ? 'not-allowed' : 'pointer',
            border: 'none', background: validation.valid && !installing ? 'var(--amber)' : 'var(--surface-hover)',
            color: validation.valid && !installing ? '#000' : 'var(--text-muted)',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {installing && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          {installing ? 'Installing…' : 'Install'}
        </button>
      </div>
    </div>
  );
}

function DoneStep({ result, onClose }: { result: AgentarInstallResult; onClose: () => void }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
        color: 'var(--success)',
      }}>
        <CheckCircle2 size={20} />
        <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Installed</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
        <Row label="Workspace" value={result.workspace_path} />
        <Row label="README" value={result.readme_path} />
        {result.missing_skills.length > 0 && (
          <Row label="Pending skills" value={result.missing_skills.join(', ')} />
        )}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        A token was issued and cached. The agent will appear in your tree after the list refreshes.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            cursor: 'pointer', border: 'none', background: 'var(--amber)', color: '#000', fontWeight: 600,
          }}
        >Done</button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ minWidth: 110, color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>{value}</span>
    </div>
  );
}

function Banner({ kind, title, children }: { kind: 'error' | 'warning' | 'info'; title: string; children: React.ReactNode }) {
  const palette: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
    error: { bg: 'rgba(239,68,68,0.1)', border: 'var(--error)', color: 'var(--error)', icon: <AlertTriangle size={14} /> },
    warning: { bg: 'rgba(234,179,8,0.1)', border: 'var(--warning, #ca8a04)', color: 'var(--warning, #ca8a04)', icon: <AlertTriangle size={14} /> },
    info: { bg: 'var(--surface)', border: 'var(--border)', color: 'var(--text-dim)', icon: <Package size={14} /> },
  };
  const p = palette[kind];
  return (
    <div style={{
      background: p.bg, border: `1px solid ${p.border}`, borderRadius: 'var(--radius-md)',
      padding: 12, marginBottom: 10, fontSize: '0.75rem', color: p.color,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 6 }}>
        {p.icon} {title}
      </div>
      <div style={{ color: 'var(--text-dim)' }}>{children}</div>
    </div>
  );
}
