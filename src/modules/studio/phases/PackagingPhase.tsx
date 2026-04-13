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

// ─── Studio Phase 10 — packaging viewport ───────────────────────────
//
// Shown when the project is in 'packaging' or 'packaged' status.
// Three states:
//   1. Build CTA — runs the packager service end-to-end
//   2. Build in progress — spinner
//   3. Built — shows package metadata, scan report, download + install CTAs
//
// Re-running the build is allowed at any time (the packager is idempotent).

import { useState } from 'react';
import { Package, Loader2, Download, Rocket, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStudioStore,
  type StudioProject,
  type StudioPackageResult,
} from '@/stores/studio.store';
import { SafetyScannerReport } from '../components/SafetyScannerReport';
import { RewindButton } from '../components/RewindButton';

interface Props {
  project: StudioProject;
  viewMode?: 'edit' | 'past';
}

export function PackagingPhase({ project, viewMode = 'edit' }: Props) {
  const isPast = viewMode === 'past';
  const packageProject = useStudioStore((s) => s.packageProject);
  const installPackagedProject = useStudioStore((s) => s.installPackagedProject);
  const refetchProject = useStudioStore((s) => s.refetchProject);
  const packageDownloadUrl = useStudioStore((s) => s.packageDownloadUrl);

  const [busy, setBusy] = useState<'build' | 'install' | null>(null);
  const [latest, setLatest] = useState<StudioPackageResult | null>(null);

  const isPackaged = project.status === 'packaged' && project.package_path;

  async function handleBuild() {
    setBusy('build');
    try {
      const result = await packageProject(project.id);
      setLatest(result);
      await refetchProject(project.id);
      toast.success(`Built ${result.manifest_name} v${result.package_version}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Build failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleInstall() {
    setBusy('install');
    try {
      const result = await installPackagedProject(project.id);
      await refetchProject(project.id);
      toast.success(`Installed ${result.manifest_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <h2 style={titleStyle}>
          <Package size={14} style={{ color: 'var(--amber)' }} />
          Empaquetado
        </h2>
        <div style={{ flex: 1 }} />
        {isPackaged && (
          <span style={{
            fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}>
            v{project.package_version} · {humanBytes(project.package_size_bytes ?? 0)}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 720, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Checklist + build CTA */}
          <div style={cardStyle}>
            <h3 style={cardTitle}>
              <Shield size={14} style={{ color: 'var(--amber)' }} /> Construir el .claw
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Studio empaquetará el workspace + el manifest + las migraciones aplicadas en un único archivo
              <code style={{ margin: '0 4px', fontFamily: 'var(--font-mono)' }}>.claw</code>
              firmado. Antes de empaquetar, el Safety Scanner inspecciona el código y bloquea cualquier patrón
              peligroso (acceso a credenciales, prompt injection, SQL destructivo, etc).
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              {isPast ? (
                <RewindButton projectId={project.id} target="implementation" label="Rewind a implementación" />
              ) : (
                <button
                  type="button"
                  onClick={handleBuild}
                  disabled={busy !== null}
                  style={primaryBtn(busy === 'build')}
                >
                  {busy === 'build'
                    ? <><Loader2 size={14} className="animate-spin" /> Construyendo…</>
                    : (isPackaged
                        ? <><RefreshCw size={14} /> Reconstruir</>
                        : <><Package size={14} /> Construir .claw</>)
                  }
                </button>
              )}
            </div>
          </div>

          {/* Scan results from latest build */}
          {latest && <SafetyScannerReport result={latest.scan_result} />}

          {/* Downloaded / install CTAs */}
          {isPackaged && (
            <div style={cardStyle}>
              <h3 style={cardTitle}>
                <Rocket size={14} style={{ color: '#22c55e' }} /> Listo para usar
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Tu app está empaquetada en
                <code style={{ margin: '0 4px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {project.package_path}
                </code>
              </p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href={packageDownloadUrl(project.id)}
                  download
                  style={secondaryLink}
                >
                  <Download size={14} /> Descargar .claw
                </a>
                {!isPast && (
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={busy !== null}
                    style={primaryBtn(busy === 'install')}
                  >
                    {busy === 'install'
                      ? <><Loader2 size={14} className="animate-spin" /> Instalando…</>
                      : <><Rocket size={14} /> Instalar localmente</>
                    }
                  </button>
                )}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Instalar localmente copia el paquete a <code>core/apps/</code> y la app aparecerá en
                tu sidebar tras reiniciar el Core.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ─── Styles ────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  padding: '12px 24px', borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
};
const titleStyle: React.CSSProperties = {
  fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text)',
  display: 'flex', alignItems: 'center', gap: 8,
};
const cardStyle: React.CSSProperties = {
  padding: 18,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
};
const cardTitle: React.CSSProperties = {
  margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
  display: 'flex', alignItems: 'center', gap: 8,
};
const primaryBtn = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 18px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '0.8125rem', fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
const secondaryLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 18px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.8125rem', fontWeight: 600,
  textDecoration: 'none',
  fontFamily: 'var(--font-sans)',
};
