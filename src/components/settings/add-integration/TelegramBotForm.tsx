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

export function TelegramBotForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [botToken, setBotToken] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!botToken) return;

    setSaving(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'telegram-observer',
        config: { bot_token: botToken },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Telegram');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Create a Telegram bot via <strong>@BotFather</strong> and paste the token here.
      </div>
      <Field label="Bot Token">
        <Input
          type="password"
          value={botToken}
          onChange={e => setBotToken(e.target.value)}
          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          required
        />
      </Field>
      <FormActions onBack={onCancel} saving={saving} disabled={!botToken} />
    </form>
  );
}
