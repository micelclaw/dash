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
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import * as syncSvc from '@/services/sync.service';
import { Field, FormActions } from './shared';

export function SessionForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [sessionId, setSessionId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !privateKey) return;

    setSaving(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'session-observer',
        config: {
          session_id: sessionId,
          private_key: privateKey,
          display_name: displayName || undefined,
        },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Session');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Enter your Session ID and recovery phrase (private key) to observe messages.
      </div>
      <Field label="Session ID" hint="Your public Session ID (starts with 05).">
        <Input
          type="text"
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
          placeholder="05abc123..."
          required
          className="font-mono"
        />
      </Field>
      <Field label="Private Key / Recovery Phrase">
        <Input
          type="password"
          value={privateKey}
          onChange={e => setPrivateKey(e.target.value)}
          placeholder="Recovery phrase or hex private key"
          required
        />
      </Field>
      <Field label="Display Name (optional)">
        <Input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="My Session"
        />
      </Field>
      <FormActions onBack={onCancel} saving={saving} disabled={!sessionId || !privateKey} />
    </form>
  );
}
