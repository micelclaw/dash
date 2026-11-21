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

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as syncSvc from '@/services/sync.service';
import { Field, FormActions } from './shared';
import { useI18n } from '@/i18n';

export function DiscordBotForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [botToken, setBotToken] = useState('');
  const [guildId, setGuildId] = useState('');
  const [guilds, setGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [discovery, setDiscovery] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [partial, setPartial] = useState(false);
  const [manual, setManual] = useState(false);
  const generation = useRef(0);
  const discovering = useRef(false);
  useEffect(() => () => { ++generation.current; }, []);

  async function findGuilds() {
    if (!botToken.trim() || discovering.current) return;
    const current = ++generation.current;
    discovering.current = true;
    setDiscovery('loading'); setGuildId(''); setGuilds([]); setPartial(false); setManual(false);
    try {
      const result = await syncSvc.discoverDiscordGuilds(botToken.trim());
      if (current !== generation.current) return;
      setGuilds(result.guilds); setPartial(result.has_more); setDiscovery('done');
      if (result.guilds.length === 1 && !result.has_more) setGuildId(result.guilds[0]!.id);
    } catch {
      if (current !== generation.current) return;
      setDiscovery('error');
      toast.error(tRef.current('settings.discord.lookupFailed'));
    } finally {
      if (current === generation.current) discovering.current = false;
    }
  }
  // DIR4: sin el id de la PERSONA, lo que el usuario escribe desde su propia
  // cuenta de Discord entra como «recibido» — el único id que el bot conoce es el
  // suyo. No se puede deducir sin arriesgarse a marcar a otro como el usuario.
  const [ownerId, setOwnerId] = useState('');
  // Un snowflake de Discord son 17-20 dígitos. Se valida en el formulario ADEMÁS
  // de en el servidor: pegar el nombre de usuario por error es el fallo probable,
  // y verlo aquí evita un viaje de ida y vuelta para descubrirlo.
  const ownerIdValido = /^\d{17,20}$/.test(ownerId.trim());
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || discovery === 'loading' || !botToken.trim() || !/^\d{17,20}$/.test(guildId.trim()) || !ownerIdValido) return;

    setSaving(true);
    try {
      await syncSvc.createConnector({
        connector_type: 'discord-observer',
        config: { bot_token: botToken.trim(), guild_id: guildId.trim(), owner_discord_user_id: ownerId.trim() },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || tRef.current('settings.discord.connectFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {t('settings.discord.intro')}
      </div>
      <ol style={{
        margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3,
        fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.55,
      }}>
        <li>
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" style={{ color: 'var(--amber)' }}>
            {t('settings.discord.portal')}
          </a>{' '}{t('settings.discord.stepApp')}
        </li>
        <li>{t('settings.discord.stepBot')} {t('settings.discord.stepInvite')}</li>
        <li>{t('settings.discord.stepSearch')}</li>
      </ol>
      {/* LA trampa del modelo bot: sin el Message Content Intent, Discord devuelve
          content vacío → se sincronizan mensajes en blanco EN SILENCIO. */}
      <div style={{
        display: 'flex', gap: 8, padding: '9px 11px',
        background: 'var(--surface)', border: '1px solid var(--amber)',
        borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5,
      }}>
        <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
        <span>
          {t('settings.discord.intentRequired')}
        </span>
      </div>
      <Field label={t('settings.discord.token')}>
        <Input
          type="password"
          aria-label={t('settings.discord.token')}
          value={botToken}
          onChange={e => {
            ++generation.current; discovering.current = false;
            setBotToken(e.target.value); setGuildId(''); setGuilds([]); setPartial(false); setDiscovery('idle');
          }}
          placeholder={t('settings.discord.tokenPlaceholder')}
          required
        />
      </Field>
      <Button type="button" variant="outline" disabled={!botToken.trim() || discovery === 'loading' || saving} onClick={() => { void findGuilds(); }}>
        {discovery === 'loading' ? t('settings.discord.searching') : t('settings.discord.search')}
      </Button>
      <div aria-live="polite">
        {discovery === 'done' && guilds.length === 0 && t('settings.discord.empty')}
        {discovery === 'error' && t('settings.discord.lookupFailed')}
        {partial && t('settings.discord.partial')}
      </div>
      {!manual && guilds.length > 0 && <Field label={t('settings.discord.server')}>
        <Select value={guildId} onValueChange={setGuildId} disabled={saving || discovery === 'loading'}>
          <SelectTrigger aria-label={t('settings.discord.server')}><SelectValue placeholder={t('settings.discord.selectServer')} /></SelectTrigger>
          <SelectContent>{guilds.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>}
      <Button type="button" variant="ghost" disabled={saving || discovery === 'loading'} aria-expanded={manual} onClick={() => { setManual(v => !v); setGuildId(''); }}>
        {manual ? t('settings.discord.manualBack') : t('settings.discord.manualId')}
      </Button>
      {manual && <Field label={t('settings.discord.serverId')} hint={t('settings.discord.serverIdHint')}>
        <Input aria-label={t('settings.discord.serverId')} type="text" value={guildId} onChange={e => setGuildId(e.target.value)} placeholder={t('settings.discord.serverIdPlaceholder')} required disabled={saving} />
      </Field>}
      <Field
        label={t('settings.discord.ownerId')}
        hint={t('settings.discord.ownerIdHint')}
      >
        <Input
          type="text"
          aria-label={t('settings.discord.ownerId')}
          value={ownerId}
          onChange={e => setOwnerId(e.target.value)}
          placeholder="348132819840434177"
          required
        />
        {ownerId.trim() && !ownerIdValido && (
          <p style={{ fontSize: '0.625rem', color: '#fbbf24', marginTop: 4 }}>
            {t('settings.discord.ownerIdInvalid')}
          </p>
        )}
      </Field>
      <FormActions onBack={onCancel} saving={saving} disabled={!botToken.trim() || !/^\d{17,20}$/.test(guildId.trim()) || !ownerIdValido || discovery === 'loading'} />
    </form>
  );
}
