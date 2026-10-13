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

export function DiscordBotForm({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
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
      toast.error('No se pudieron consultar los servidores. Comprueba el token y los permisos del bot y vuelve a intentarlo.');
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
      toast.error(err?.message || 'Failed to connect Discord');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Micelclaw reads your server through a Discord <strong>bot</strong> — you'll see the server
        channels the bot can access, not your personal DMs.
      </div>
      <ol style={{
        margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3,
        fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.55,
      }}>
        <li>
          In the{' '}
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" style={{ color: 'var(--amber)' }}>
            Discord Developer Portal
          </a>{' '}
          → New Application → <strong>Bot</strong> → Reset Token → copy it.
        </li>
        <li>
          Add the bot to a server you own — if you don't have one, create it in Discord first (the
          <strong> + </strong> button → <em>Create My Own</em>). Then: OAuth2 → URL Generator → scope
          <strong> bot</strong> + <em>View Channels</em>, <em>Read Message History</em>,
          <em> Send Messages</em> → open the generated URL → Authorize on your server.
        </li>
        <li>Pega el token y pulsa <strong>Buscar servidores</strong> para elegir dónde está el bot.</li>
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
          <strong>Required:</strong> in your bot's settings, under <em>Privileged Gateway Intents</em>,
          turn on <strong>Message Content Intent</strong>. Without it Discord sends empty message text
          and Micelclaw will sync blank messages.
        </span>
      </div>
      <Field label="Bot Token">
        <Input
          type="password"
          aria-label="Bot Token"
          value={botToken}
          onChange={e => {
            ++generation.current; discovering.current = false;
            setBotToken(e.target.value); setGuildId(''); setGuilds([]); setPartial(false); setDiscovery('idle');
          }}
          placeholder="Bot token from Discord Developer Portal"
          required
        />
      </Field>
      <Button type="button" variant="outline" disabled={!botToken.trim() || discovery === 'loading' || saving} onClick={() => { void findGuilds(); }}>
        {discovery === 'loading' ? 'Buscando servidores…' : 'Buscar servidores'}
      </Button>
      <div aria-live="polite">
        {discovery === 'done' && guilds.length === 0 && 'El bot no está en ningún servidor. Invítalo a uno y vuelve a buscar.'}
        {discovery === 'error' && 'No se pudo consultar Discord. Puedes reintentar o introducir el ID manualmente.'}
        {partial && 'La lista es parcial. Si no aparece tu servidor, introduce su ID manualmente.'}
      </div>
      {!manual && guilds.length > 0 && <Field label="Servidor">
        <Select value={guildId} onValueChange={setGuildId} disabled={saving || discovery === 'loading'}>
          <SelectTrigger aria-label="Servidor"><SelectValue placeholder="Elige un servidor" /></SelectTrigger>
          <SelectContent>{guilds.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>}
      <Button type="button" variant="ghost" disabled={saving || discovery === 'loading'} aria-expanded={manual} onClick={() => { setManual(v => !v); setGuildId(''); }}>
        {manual ? 'Volver al selector' : 'Introducir Server ID manualmente'}
      </Button>
      {manual && <Field label="Server (Guild) ID" hint="Discord → Developer Mode → clic derecho en el servidor → Copy Server ID (no el Client ID del bot).">
        <Input aria-label="Server (Guild) ID" type="text" value={guildId} onChange={e => setGuildId(e.target.value)} placeholder="Server ID de 17–20 dígitos" required disabled={saving} />
      </Field>}
      <Field
        label="Your Discord user ID"
        hint="Discord → User Settings → Advanced → turn on Developer Mode, then right-click your own name → Copy User ID. Without it, everything you write from your own account shows up as received."
      >
        <Input
          type="text"
          aria-label="Your Discord user ID"
          value={ownerId}
          onChange={e => setOwnerId(e.target.value)}
          placeholder="348132819840434177"
          required
        />
        {ownerId.trim() && !ownerIdValido && (
          <p style={{ fontSize: '0.625rem', color: '#fbbf24', marginTop: 4 }}>
            That looks like a username. It should be 17–20 digits — copy it with Developer Mode on.
          </p>
        )}
      </Field>
      <FormActions onBack={onCancel} saving={saving} disabled={!botToken.trim() || !/^\d{17,20}$/.test(guildId.trim()) || !ownerIdValido || discovery === 'loading'} />
    </form>
  );
}
