/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { SettingsBlock } from '../shared/SettingsBlock';
import { SectionShell } from '../shared/SectionShell';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { describeError } from '@/lib/api-errors';

const QUEUE_MODES = [
  {
    value: 'collect',
    label: 'Collect',
    desc: 'Wait for the agent to finish, then deliver everything as one batch. Best for: thoughtful replies, no interruptions.',
  },
  {
    value: 'steer',
    label: 'Steer',
    desc: 'Inject the new message into the current run mid-thought (cancels pending tools). Best for: course-correcting an agent that\'s going off track.',
  },
  {
    value: 'followup',
    label: 'Follow-up',
    desc: 'Queue messages and start a new turn after the current one finishes. Best for: rapid back-and-forth conversation.',
  },
  {
    value: 'interrupt',
    label: 'Interrupt',
    desc: 'Stop the agent immediately and process the new message. Best for: urgent overrides ("stop, do X instead").',
  },
];

const TYPING_MODES = [
  { value: 'never', label: 'Never' },
  { value: 'instant', label: 'Instant (as soon as processing starts)' },
  { value: 'thinking', label: 'Thinking (on first reasoning delta)' },
  { value: 'message', label: 'Message (on first text output)' },
];

const HUMAN_DELAY_MODES = [
  { value: 'off', label: 'Off (instant replies)' },
  { value: 'natural', label: 'Natural (800-2500ms random delay)' },
  { value: 'custom', label: 'Custom (set min/max)' },
];

const TTS_AUTO_MODES = [
  { value: 'off', label: 'Off' },
  { value: 'always', label: 'Always (all replies as audio)' },
  { value: 'inbound', label: 'Inbound (audio reply after voice message)' },
  { value: 'tagged', label: 'Tagged (only when reply includes [[tts]])' },
];

const TTS_PROVIDERS = [
  { value: 'edge', label: 'Edge TTS (free, Microsoft neural voices)' },
  { value: 'openai', label: 'OpenAI TTS (requires API key)' },
  { value: 'elevenlabs', label: 'ElevenLabs (requires API key)' },
];

const ACK_REACTION_SCOPES = [
  { value: 'off', label: 'Off' },
  { value: 'group-mentions', label: 'Group mentions only' },
  { value: 'group-all', label: 'All group messages' },
  { value: 'direct', label: 'Direct messages only' },
  { value: 'all', label: 'All messages' },
];

function SelectRow({ label, desc, value, options, onChange }: {
  label: string;
  desc?: string;
  value: string;
  options: { value: string; label: string; desc?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</span>
          {desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
        </div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            padding: '4px 8px', fontSize: '0.75rem', minWidth: 180,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function NumberRow({ label, desc, value, min, max, suffix, onChange }: {
  label: string;
  desc?: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</span>
          {desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number" value={value} min={min} max={max}
            onChange={e => onChange(parseInt(e.target.value, 10) || min)}
            style={{
              padding: '4px 8px', fontSize: '0.75rem', width: 70, textAlign: 'right',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontFamily: 'var(--font-mono, var(--font-sans))',
            }}
          />
          {suffix && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{label}</span>
          {desc && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
        </div>
        <ToggleSwitch checked={value} onChange={onChange} ariaLabel={label} />
      </div>
    </div>
  );
}

export function ChannelBindingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Queue state
  const [queueMode, setQueueMode] = useState('collect');
  const [queueDebounce, setQueueDebounce] = useState(1000);
  const [queueCap, setQueueCap] = useState(20);
  const [inboundDebounce, setInboundDebounce] = useState(2000);

  // Streaming state
  const [blockStreaming, setBlockStreaming] = useState('off');
  const [humanDelay, setHumanDelay] = useState('off');
  const [typingMode, setTypingMode] = useState('instant');
  const [typingInterval, setTypingInterval] = useState(6);

  // Status reactions state
  const [reactionsEnabled, setReactionsEnabled] = useState(false);

  // Ack reaction
  const [ackReaction, setAckReaction] = useState('');
  const [ackReactionScope, setAckReactionScope] = useState('group-mentions');

  // TTS state
  const [ttsAuto, setTtsAuto] = useState('off');
  const [ttsProvider, setTtsProvider] = useState('edge');

  const [sections, setSections] = useState<Record<string, boolean>>({
    queue: true, streaming: false, reactions: false, tts: false,
  });

  const toggleSection = (key: string) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gwService.getMessagesConfig();
      const q = (data.queue ?? {}) as Record<string, unknown>;
      const s = (data.streaming ?? {}) as Record<string, unknown>;
      const sr = (data.status_reactions ?? {}) as Record<string, unknown>;
      const tts = (data.tts ?? {}) as Record<string, unknown>;

      setQueueMode((q.mode ?? 'collect') as string);
      setQueueDebounce((q.debounce_ms ?? 1000) as number);
      setQueueCap((q.cap ?? 20) as number);
      const inb = (data.inbound ?? {}) as Record<string, unknown>;
      setInboundDebounce((inb.debounce_ms ?? 2000) as number);

      setBlockStreaming((s.block_streaming_default ?? 'off') as string);
      setHumanDelay(((s.human_delay ?? {}) as Record<string, unknown>).mode as string ?? 'off');
      setTypingMode((s.typing_mode ?? 'instant') as string);
      setTypingInterval((s.typing_interval_seconds ?? 6) as number);

      setReactionsEnabled((sr.enabled ?? false) as boolean);

      setAckReaction((data.ack_reaction ?? '') as string);
      setAckReactionScope((data.ack_reaction_scope ?? 'group-mentions') as string);

      setTtsAuto((tts.auto ?? 'off') as string);
      setTtsProvider((tts.provider ?? 'edge') as string);

      setDirty(false);
    } catch {
      toast.error('Failed to load channel bindings config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await gwService.updateMessagesConfig({
        queue: {
          mode: queueMode,
          debounceMs: queueDebounce,
          cap: queueCap,
        },
        inbound: {
          debounceMs: inboundDebounce,
        },
        status_reactions: {
          enabled: reactionsEnabled,
        },
        ack_reaction: ackReaction || null,
        ack_reaction_scope: ackReactionScope,
        tts: {
          auto: ttsAuto,
          provider: ttsProvider,
        },
        streaming: {
          blockStreamingDefault: blockStreaming,
          humanDelay: { mode: humanDelay },
          typingMode,
          typingIntervalSeconds: typingInterval,
        },
      });
      toast.success('Channel Bindings saved');
      setDirty(false);
    } catch (err) {
      toast.error(describeError(err, 'Failed to update channel bindings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="Channel Bindings"
      description="Configure how your agents communicate via messaging platforms. Per-channel settings are in Gateway → Channels."
      loading={loading}
      dirty={dirty}
      saving={saving}
      onSave={handleSave}
    >
      {/* Message Queue */}
      <SettingsBlock
        title="Message Queue"
        description="What happens when messages arrive while the agent is busy"
        expanded={sections.queue!}
        onToggle={() => toggleSection('queue')}
      >
        <SelectRow label="Queue mode" value={queueMode} options={QUEUE_MODES} onChange={markDirty(setQueueMode)} />
        <NumberRow label="Queue debounce" desc="Wait before starting followup turn" value={queueDebounce} min={0} max={10000} suffix="ms" onChange={markDirty(setQueueDebounce)} />
        <NumberRow label="Queue cap" desc="Max messages in queue per session" value={queueCap} min={1} max={100} onChange={markDirty(setQueueCap)} />
        <NumberRow label="Inbound debounce" desc="Group rapid messages from same sender" value={inboundDebounce} min={0} max={10000} suffix="ms" onChange={markDirty(setInboundDebounce)} />
      </SettingsBlock>

      {/* Streaming & Typing */}
      <SettingsBlock
        title="Streaming & Typing"
        description="How responses are displayed in messaging platforms"
        expanded={sections.streaming!}
        onToggle={() => toggleSection('streaming')}
      >
        <SelectRow
          label="Stream replies"
          desc="When ON, the agent sends each paragraph/block as soon as it's written (feels live). When OFF, the user waits and gets the full reply at once."
          value={blockStreaming}
          options={[
            { value: 'on', label: 'On — send blocks as they complete (recommended)' },
            { value: 'off', label: 'Off — send the full reply when done' },
          ]}
          onChange={markDirty(setBlockStreaming)}
        />
        <SelectRow label="Human delay" desc="Pause between blocks to feel natural" value={humanDelay} options={HUMAN_DELAY_MODES} onChange={markDirty(setHumanDelay)} />
        <SelectRow label="Typing indicator" desc="When to show typing indicator" value={typingMode} options={TYPING_MODES} onChange={markDirty(setTypingMode)} />
        <NumberRow label="Typing refresh interval" value={typingInterval} min={1} max={30} suffix="sec" onChange={markDirty(setTypingInterval)} />
      </SettingsBlock>

      {/* Status Reactions & Ack */}
      <SettingsBlock
        title="Reactions"
        description="Emoji reactions while the agent works"
        expanded={sections.reactions!}
        onToggle={() => toggleSection('reactions')}
      >
        <ToggleRow
          label="Status reactions"
          desc="Show emoji for thinking, tool use, coding, errors, etc."
          value={reactionsEnabled}
          onChange={markDirty(setReactionsEnabled)}
        />
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Ack reaction emoji</span>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Emoji reaction sent immediately when a message is received (acknowledgement). Leave empty to disable. Single emoji only — no text.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={ackReaction}
                placeholder="👀"
                maxLength={4}
                onChange={(e) => {
                  const v = e.target.value;
                  // Strip whitespace and any plain ASCII text — only keep
                  // characters outside the basic Latin range (likely emoji).
                  // Imperfect (some emojis use multi-codepoint ZWJ sequences)
                  // but catches the common "user typed a word by mistake" case.
                  const cleaned = v.replace(/[\s\x00-\x7F]/g, '');
                  setAckReaction(cleaned);
                  setDirty(true);
                }}
                style={{
                  padding: '4px 8px', fontSize: '0.875rem', width: 50, textAlign: 'center',
                  background: 'var(--surface)',
                  border: `1px solid ${
                    !ackReaction || /[^\x00-\x7F]/.test(ackReaction) ? 'var(--border)' : '#ef4444'
                  }`,
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                }}
              />
              {ackReaction && /^[\x00-\x7F]+$/.test(ackReaction) && (
                <span style={{ fontSize: '0.625rem', color: '#ef4444' }} title="Not an emoji — try 👀, 👍, ✅, etc.">
                  !
                </span>
              )}
            </div>
          </div>
        </div>
        <SelectRow label="Ack reaction scope" value={ackReactionScope} options={ACK_REACTION_SCOPES} onChange={markDirty(setAckReactionScope)} />
      </SettingsBlock>

      {/* TTS */}
      <SettingsBlock
        title="Bot TTS (Text-to-Speech)"
        description="Let agents send audio responses in messaging platforms"
        expanded={sections.tts!}
        onToggle={() => toggleSection('tts')}
      >
        <SelectRow label="Auto TTS" desc="When to convert replies to audio" value={ttsAuto} options={TTS_AUTO_MODES} onChange={markDirty(setTtsAuto)} />
        <SelectRow label="TTS provider" desc="Edge TTS is free and requires no API key" value={ttsProvider} options={TTS_PROVIDERS} onChange={markDirty(setTtsProvider)} />
        {ttsProvider === 'edge' && (
          <div style={{ padding: '4px 0', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            Edge TTS uses Microsoft neural voices. No API key needed. Default voice: en-US-MichelleNeural.
          </div>
        )}
        {ttsProvider === 'openai' && (
          <div style={{ padding: '4px 0', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            Requires OpenAI API key. Voices: alloy, echo, fable, onyx, nova, shimmer. Configure in AI &rarr; API Keys.
          </div>
        )}
        {ttsProvider === 'elevenlabs' && (
          <div style={{ padding: '4px 0', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            Requires ElevenLabs API key. Supports custom voices and multilingual models. Configure key in environment.
          </div>
        )}
      </SettingsBlock>
    </SectionShell>
  );
}
