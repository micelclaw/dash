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
import {
  Globe, Plus, ArrowLeft, RefreshCw, Trash2, Shield, Cloud,
  CheckCircle, AlertTriangle, ChevronRight, BookOpen,
} from 'lucide-react';
import type { DnsZone, DnsRecord, DnsRecordInput, DnsTemplate, DnssecStatus, NsVerificationResult, AddZoneInput } from '../hooks/use-dns-zones';
import type { DnsProviderAccount } from '../hooks/use-dns-providers';
import { ZoneEditor } from './ZoneEditor';
import { AddZoneWizard } from './AddZoneWizard';
import { ApplyTemplateModal } from './ApplyTemplateModal';

interface ZonesSectionProps {
  zones: DnsZone[];
  records: DnsRecord[];
  templates: DnsTemplate[];
  providers: DnsProviderAccount[];
  loading: boolean;
  recordsLoading: boolean;
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  onAddZone: (input: AddZoneInput) => Promise<DnsZone | null>;
  onRemoveZone: (id: string) => Promise<void>;
  onSyncZone: (id: string) => Promise<void>;
  onVerifyNs: (id: string) => Promise<NsVerificationResult | null>;
  onUpdateDdns: (id: string, enabled: boolean, recordIds: string[]) => Promise<void>;
  onCreateRecord: (zoneId: string, input: DnsRecordInput) => Promise<void>;
  onUpdateRecord: (zoneId: string, recordId: string, input: Partial<DnsRecordInput>) => Promise<void>;
  onDeleteRecord: (zoneId: string, recordId: string) => Promise<void>;
  onApplyTemplate: (zoneId: string, templateId: string, variables: Record<string, string>) => Promise<boolean>;
  onGetPublicIp: () => Promise<string | null>;
  onCheckPort53: () => Promise<{ accessible: boolean; udp: boolean; tcp: boolean; recommendation: string | null } | null>;
  onGetDnssecStatus: (zoneId: string) => Promise<DnssecStatus | null>;
  onEnableDnssec: (zoneId: string) => Promise<DnssecStatus | null>;
  onDisableDnssec: (zoneId: string) => Promise<void>;
  onNavigateSubdomain?: () => void;
}

export function ZonesSection(props: ZonesSectionProps) {
  const {
    zones, records, templates, providers, loading, recordsLoading,
    selectedZoneId, onSelectZone,
    onAddZone, onRemoveZone, onSyncZone, onVerifyNs, onUpdateDdns,
    onCreateRecord, onUpdateRecord, onDeleteRecord,
    onApplyTemplate, onGetPublicIp, onCheckPort53,
    onGetDnssecStatus, onEnableDnssec, onDisableDnssec,
    onNavigateSubdomain,
  } = props;

  const [showWizard, setShowWizard] = useState(false);
  const [templateZoneId, setTemplateZoneId] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading zones...
      </div>
    );
  }

  const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null;

  // ─── Zone Editor view ────────────────────────────────────
  if (selectedZone) {
    return (
      <div style={{ padding: 24, maxWidth: 900 }}>
        <button
          onClick={() => onSelectZone(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', padding: 0,
            color: 'var(--text-muted)', fontSize: '0.8125rem',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          Back to zones
        </button>

        <ZoneEditor
          zone={selectedZone}
          records={records}
          loading={recordsLoading}
          onSync={() => onSyncZone(selectedZone.id)}
          onVerifyNs={() => onVerifyNs(selectedZone.id)}
          onUpdateDdns={(enabled, ids) => onUpdateDdns(selectedZone.id, enabled, ids)}
          onCreateRecord={(input) => onCreateRecord(selectedZone.id, input)}
          onUpdateRecord={(rid, input) => onUpdateRecord(selectedZone.id, rid, input)}
          onDeleteRecord={(rid) => onDeleteRecord(selectedZone.id, rid)}
          onShowTemplates={() => setTemplateZoneId(selectedZone.id)}
          onRemove={() => { onRemoveZone(selectedZone.id); onSelectZone(null); }}
          onGetDnssecStatus={onGetDnssecStatus}
          onEnableDnssec={onEnableDnssec}
          onDisableDnssec={onDisableDnssec}
        />

        {templateZoneId && (
          <ApplyTemplateModal
            templates={templates}
            onApply={(templateId, vars) => onApplyTemplate(templateZoneId, templateId, vars)}
            onClose={() => setTemplateZoneId(null)}
          />
        )}
      </div>
    );
  }

  // ─── Add zone wizard ─────────────────────────────────────
  if (showWizard) {
    return (
      <div style={{ padding: 24, maxWidth: 600 }}>
        <button
          onClick={() => setShowWizard(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', padding: 0,
            color: 'var(--text-muted)', fontSize: '0.8125rem',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          Back to zones
        </button>

        <AddZoneWizard
          providers={providers}
          onAdd={async (input) => {
            const zone = await onAddZone(input);
            if (zone) {
              setShowWizard(false);
              onSelectZone(zone.id);
            }
          }}
          onGetPublicIp={onGetPublicIp}
          onCheckPort53={onCheckPort53}
        />
      </div>
    );
  }

  // ─── Zone list ───────────────────────────────────────────
  const micelclawZones = zones.filter(z => z.zone_type === 'micelclaw_subdomain');
  const ownZones = zones.filter(z => z.zone_type === 'own_domain');

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          margin: 0, fontFamily: 'var(--font-sans)',
        }}>
          DNS Zones
        </h2>
        <button
          onClick={() => setShowWizard(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} />
          Add Zone
        </button>
      </div>

      {zones.length === 0 ? (
        <EmptyState onAdd={() => setShowWizard(true)} onNavigateSubdomain={onNavigateSubdomain} />
      ) : (
        <>
          {micelclawZones.length > 0 && (
            <ZoneGroup label="Micelclaw Subdomains" zones={micelclawZones} onSelect={onSelectZone} />
          )}
          {ownZones.length > 0 && (
            <ZoneGroup label="Your Domains" zones={ownZones} onSelect={onSelectZone} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Zone Group ──────────────────────────────────────────────────────

function ZoneGroup({ label, zones, onSelect }: { label: string; zones: DnsZone[]; onSelect: (id: string) => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {zones.map((zone, i) => (
          <ZoneRow key={zone.id} zone={zone} onSelect={() => onSelect(zone.id)} isLast={i === zones.length - 1} />
        ))}
      </div>
    </div>
  );
}

function ZoneRow({ zone, onSelect, isLast }: { zone: DnsZone; onSelect: () => void; isLast: boolean }) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%',
        padding: '14px 16px',
        background: 'var(--card)',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: zone.mode === 'authoritative' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        flexShrink: 0,
      }}>
        {zone.mode === 'authoritative'
          ? <Shield size={18} style={{ color: '#3b82f6' }} />
          : <Cloud size={18} style={{ color: '#f59e0b' }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
          fontFamily: 'var(--font-mono, monospace)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {zone.zone}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 2, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          <span>{zone.mode === 'authoritative' ? 'Authoritative' : 'Proxy'}</span>
          {zone.provider_label && <span>{zone.provider_label}</span>}
          {zone.records_count != null && <span>{zone.records_count} records</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {zone.dnssec_enabled && (
          <span style={{
            fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px',
            borderRadius: 3, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
          }}>
            DNSSEC
          </span>
        )}
        {zone.ddns_enabled && (
          <span style={{
            fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px',
            borderRadius: 3, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
          }}>
            DDNS
          </span>
        )}
        {zone.mode === 'authoritative' && (
          zone.ns_verified
            ? <CheckCircle size={14} style={{ color: '#22c55e' }} />
            : <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
        )}
        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
      </div>
    </button>
  );
}

function EmptyState({ onAdd, onNavigateSubdomain }: { onAdd: () => void; onNavigateSubdomain?: () => void }) {
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <Globe size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
      <h3 style={{
        fontSize: '1rem', fontWeight: 600, color: 'var(--text)',
        margin: '0 0 6px', fontFamily: 'var(--font-sans)',
      }}>
        No DNS Zones
      </h3>
      <p style={{
        color: 'var(--text-muted)', fontSize: '0.8125rem',
        margin: '0 0 24px', lineHeight: 1.5, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto',
      }}>
        Una zona DNS es la configuración de un dominio. Aquí puedes gestionar los registros
        de cualquier dominio que tengas, o conectar tu cuenta de Cloudflare, Porkbun u otros proveedores.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 500, margin: '0 auto' }}>
        {/* Card A — Tengo dominio */}
        <div style={{
          padding: 20, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', background: 'var(--card)',
          textAlign: 'left',
        }}>
          <Globe size={24} style={{ color: '#3b82f6', marginBottom: 10 }} />
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Tengo un dominio propio
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
            Conecta mipropiodominio.com y gestiona sus registros desde aquí.
          </div>
          <button
            onClick={onAdd}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Conectar dominio
          </button>
        </div>

        {/* Card B — Quiero aprender */}
        <div style={{
          padding: 20, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', background: 'var(--card)',
          textAlign: 'left',
        }}>
          <BookOpen size={24} style={{ color: '#d4a017', marginBottom: 10 }} />
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Quiero aprender primero
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
            Ve cómo funciona con el subdominio gratuito de Micelclaw.
          </div>
          <button
            onClick={onNavigateSubdomain}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Ir a Mi subdominio
          </button>
        </div>
      </div>
    </div>
  );
}
