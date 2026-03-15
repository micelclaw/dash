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
import { Crown, Globe, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import type { SubdomainRequest } from '../hooks/use-subdomain';

interface SubdomainSectionProps {
  request: SubdomainRequest | null;
  loading: boolean;
  onRequest: (subdomain: string, recordTypes: string[]) => Promise<void>;
  onRelease: () => Promise<void>;
  onCheck: () => Promise<void>;
}

const RECORD_TYPE_OPTIONS = [
  { value: 'web', label: 'Web (A/CNAME)', description: 'Point your subdomain to your server' },
  { value: 'email', label: 'Email (MX/SPF/DKIM)', description: 'Set up email for your subdomain' },
  { value: 'custom', label: 'Custom Records', description: 'Add custom DNS records later' },
];

export function SubdomainSection({ request, loading, onRequest, onRelease, onCheck }: SubdomainSectionProps) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Loading subdomain status...
      </div>
    );
  }

  if (request) {
    return <SubdomainStatus request={request} onRelease={onRelease} onCheck={onCheck} />;
  }

  return <SubdomainRequestForm onRequest={onRequest} />;
}

// ─── Request Form ───────────────────────────────────────────────────

function SubdomainRequestForm({ onRequest }: { onRequest: (subdomain: string, recordTypes: string[]) => Promise<void> }) {
  const [subdomain, setSubdomain] = useState('');
  const [recordTypes, setRecordTypes] = useState<Set<string>>(new Set(['web']));
  const [requesting, setRequesting] = useState(false);

  const toggleType = (type: string) => {
    const next = new Set(recordTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setRecordTypes(next);
  };

  const isValid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) && recordTypes.size > 0;

  const handleRequest = async () => {
    if (!isValid) return;
    setRequesting(true);
    await onRequest(subdomain, Array.from(recordTypes));
    setRequesting(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      {/* Pro info card */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(212, 160, 23, 0.3)',
        background: 'linear-gradient(135deg, rgba(212, 160, 23, 0.06), rgba(212, 160, 23, 0.02))',
        padding: 24,
        textAlign: 'center',
        marginBottom: 24,
      }}>
        <Crown size={36} style={{ color: '#d4a017', marginBottom: 12 }} />
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          margin: '0 0 6px', fontFamily: 'var(--font-sans)',
        }}>
          Request a Subdomain
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
          Each Pro account gets one free subdomain under <strong style={{ color: 'var(--text-dim)' }}>micelclaw.com</strong>.
          DNS records are automatically created and managed on Cloudflare.
        </p>
      </div>

      {/* Request form */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 20,
      }}>
        {/* Subdomain input */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '0.625rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            Subdomain
          </div>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <input
              type="text"
              placeholder="your-name"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-mono, monospace)',
                outline: 'none',
              }}
            />
            <span style={{
              padding: '10px 14px',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-mono, monospace)',
              borderLeft: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              .micelclaw.com
            </span>
          </div>
          {subdomain && !isValid && (
            <p style={{ fontSize: '0.6875rem', color: '#f43f5e', margin: '4px 0 0' }}>
              Use only lowercase letters, numbers, and hyphens. Must start and end with alphanumeric.
            </p>
          )}
        </div>

        {/* Record types */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '0.625rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            Record Types
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RECORD_TYPE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  border: `1px solid ${recordTypes.has(opt.value) ? 'rgba(212, 160, 23, 0.4)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: recordTypes.has(opt.value) ? 'rgba(212, 160, 23, 0.04)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <input
                  type="checkbox"
                  checked={recordTypes.has(opt.value)}
                  onChange={() => toggleType(opt.value)}
                  style={{ accentColor: '#d4a017', marginTop: 2 }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleRequest}
          disabled={!isValid || requesting}
          style={{
            width: '100%',
            padding: '10px 20px',
            background: '#d4a017',
            color: '#000',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            cursor: (!isValid || requesting) ? 'not-allowed' : 'pointer',
            opacity: (!isValid || requesting) ? 0.5 : 1,
          }}
        >
          {requesting ? 'Requesting...' : 'Request Subdomain'}
        </button>
      </div>
    </div>
  );
}

// ─── Subdomain Status ───────────────────────────────────────────────

function SubdomainStatus({ request, onRelease, onCheck }: {
  request: SubdomainRequest;
  onRelease: () => Promise<void>;
  onCheck: () => Promise<void>;
}) {
  const [releasing, setReleasing] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const handleRelease = async () => {
    setReleasing(true);
    await onRelease();
    setReleasing(false);
    setConfirmRelease(false);
  };

  const statusStep = STATUS_STEPS[request.status] ?? 0;

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2 style={{
        fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
        margin: '0 0 20px', fontFamily: 'var(--font-sans)',
      }}>
        Your Subdomain
      </h2>

      {/* Domain display */}
      <div style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${request.status === 'active' ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
        background: request.status === 'active'
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02))'
          : 'var(--surface)',
        padding: 20,
        marginBottom: 16,
      }}>
        <div style={{
          fontSize: '1.25rem', fontWeight: 700,
          color: 'var(--text)',
          fontFamily: 'var(--font-mono, monospace)',
          marginBottom: 12,
        }}>
          {request.full_domain}
        </div>

        {/* Progress steps */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
          {STEPS.map((step, i) => (
            <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', width: '100%',
                position: 'relative',
              }}>
                {i > 0 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: statusStep >= i ? '#22c55e' : 'var(--border)',
                    transition: 'background 0.3s',
                  }} />
                )}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: statusStep >= i ? '#22c55e' : 'var(--surface)',
                  border: `2px solid ${statusStep >= i ? '#22c55e' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {statusStep > i ? (
                    <CheckCircle size={14} style={{ color: '#fff' }} />
                  ) : statusStep === i ? (
                    <step.icon size={12} style={{ color: statusStep >= i ? '#fff' : 'var(--text-muted)' }} />
                  ) : (
                    <step.icon size={12} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: statusStep > i ? '#22c55e' : 'var(--border)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: '0.625rem', fontWeight: 600,
                color: statusStep >= i ? 'var(--text)' : 'var(--text-muted)',
                marginTop: 6, textAlign: 'center',
              }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <Detail label="Record Types" value={request.record_types.join(', ')} />
          <Detail label="Server IP" value={request.server_ip} />
          <Detail label="Requested" value={new Date(request.requested_at).toLocaleDateString()} />
          {request.provisioned_at && (
            <Detail label="Provisioned" value={new Date(request.provisioned_at).toLocaleDateString()} />
          )}
        </div>

        {request.error && (
          <div style={{
            marginTop: 12, padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            fontSize: '0.75rem', color: '#f43f5e',
          }}>
            {request.error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {request.status !== 'active' && (
          <button
            onClick={onCheck}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            <Clock size={14} />
            Check Status
          </button>
        )}
        {confirmRelease ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: '#f43f5e' }}>Release this subdomain?</span>
            <button
              onClick={handleRelease}
              disabled={releasing}
              style={{
                padding: '6px 14px',
                background: '#f43f5e',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: releasing ? 'not-allowed' : 'pointer',
                opacity: releasing ? 0.5 : 1,
              }}
            >
              {releasing ? 'Releasing...' : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirmRelease(false)}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-dim)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRelease(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f43f5e',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
            Release Subdomain
          </button>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)', marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
        {value}
      </div>
    </div>
  );
}

const STEPS = [
  { key: 'requested', label: 'Requested', icon: Globe },
  { key: 'provisioning', label: 'Provisioning', icon: Clock },
  { key: 'active', label: 'Active', icon: CheckCircle },
];

const STATUS_STEPS: Record<string, number> = {
  requested: 0,
  provisioning: 1,
  active: 2,
  failed: 0,
  released: -1,
};
