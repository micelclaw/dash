/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

const QUEUE_MODES = [
  { value: 'collect', label: 'Collect', desc: 'Accumulate messages, deliver together after agent finishes' },
  { value: 'steer', label: 'Steer', desc: 'Inject into current run (cancels pending tools)' },
  { value: 'followup', label: 'Follow-up', desc: 'Queue for next agent turn' },
  { value: 'interrupt', label: 'Interrupt', desc: 'Abort current run, process new message' },
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
        <div
          onClick={() => onChange(!value)}
          style={{
            width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
            background: value ? 'var(--success, #22c55e)' : 'var(--text-muted)',
            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left 0.2s',
          }} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, expanded, onToggle, children }: {
  title: string;
  desc?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      overflow: 'hidden', marginBottom: 12,
    }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '12px 14px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
          color: 'var(--text)', fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <div>
          {title}
          {desc && <div style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-dim)', marginTop: 2 }}>{desc}</div>}
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
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
        statusReactions: {
          enabled: reactionsEnabled,
        },
        ackReaction: ackReaction || null,
        ackReactionScope: ackReactionScope,
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
      toast.success('Channel bindings config updated');
      setDirty(false);
    } catch {
      toast.error('Failed to update config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
            Channel Bindings
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Configure how your agents communicate via messaging platforms. Per-channel settings are in Gateway &rarr; Channels.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600,
            background: dirty ? 'var(--amber)' : 'var(--surface)',
            border: dirty ? 'none' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: dirty ? '#000' : 'var(--text-muted)',
            cursor: dirty ? 'pointer' : 'default',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Message Queue */}
      <Section
        title="Message Queue"
        desc="What happens when messages arrive while the agent is busy"
        expanded={sections.queue!}
        onToggle={() => toggleSection('queue')}
      >
        <SelectRow label="Queue mode" value={queueMode} options={QUEUE_MODES} onChange={markDirty(setQueueMode)} />
        <NumberRow label="Queue debounce" desc="Wait before starting followup turn" value={queueDebounce} min={0} max={10000} suffix="ms" onChange={markDirty(setQueueDebounce)} />
        <NumberRow label="Queue cap" desc="Max messages in queue per session" value={queueCap} min={1} max={100} onChange={markDirty(setQueueCap)} />
        <NumberRow label="Inbound debounce" desc="Group rapid messages from same sender" value={inboundDebounce} min={0} max={10000} suffix="ms" onChange={markDirty(setInboundDebounce)} />
      </Section>

      {/* Streaming & Typing */}
      <Section
        title="Streaming & Typing"
        desc="How responses are displayed in messaging platforms"
        expanded={sections.streaming!}
        onToggle={() => toggleSection('streaming')}
      >
        <SelectRow
          label="Block streaming"
          desc="Send response in blocks vs all at once"
          value={blockStreaming}
          options={[
            { value: 'off', label: 'Off (send complete reply)' },
            { value: 'on', label: 'On (send blocks as they complete)' },
          ]}
          onChange={markDirty(setBlockStreaming)}
        />
        <SelectRow label="Human delay" desc="Pause between blocks to feel natural" value={humanDelay} options={HUMAN_DELAY_MODES} onChange={markDirty(setHumanDelay)} />
        <SelectRow label="Typing indicator" desc="When to show typing indicator" value={typingMode} options={TYPING_MODES} onChange={markDirty(setTypingMode)} />
        <NumberRow label="Typing refresh interval" value={typingInterval} min={1} max={30} suffix="sec" onChange={markDirty(setTypingInterval)} />
      </Section>

      {/* Status Reactions & Ack */}
      <Section
        title="Reactions"
        desc="Emoji reactions while the agent works"
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
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Emoji sent immediately when a message is received</div>
            </div>
            <input
              type="text" value={ackReaction} placeholder="e.g. 👀"
              onChange={e => { setAckReaction(e.target.value); setDirty(true); }}
              style={{
                padding: '4px 8px', fontSize: '0.875rem', width: 50, textAlign: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              }}
            />
          </div>
        </div>
        <SelectRow label="Ack reaction scope" value={ackReactionScope} options={ACK_REACTION_SCOPES} onChange={markDirty(setAckReactionScope)} />
      </Section>

      {/* TTS */}
      <Section
        title="Bot TTS (Text-to-Speech)"
        desc="Let agents send audio responses in messaging platforms"
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
      </Section>
    </div>
  );
}
