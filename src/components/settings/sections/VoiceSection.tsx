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

// ─── Voice Settings Section ─────────────────────────────────────────
// Settings → Voice: STT engine, TTS voice, input mode, service status.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Mic, Volume2, Loader2, CheckCircle, XCircle, Power, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useServiceState } from '@/hooks/use-service-status';
import { useServicesStore } from '@/stores/services.store';
import { PIPER_VOICES, LANGUAGE_NAMES } from '@/data/piper-voices';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API = `${BASE_URL}/api/v1`;

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'sv', label: 'Svenska' },
  { value: 'da', label: 'Dansk' },
  { value: 'fi', label: 'Suomi' },
  { value: 'no', label: 'Norsk' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'cs', label: 'Čeština' },
  { value: 'el', label: 'Ελληνικά' },
  { value: 'hu', label: 'Magyar' },
  { value: 'ro', label: 'Română' },
  { value: 'ca', label: 'Català' },
  { value: 'uk', label: 'Українська' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'th', label: 'ไทย' },
  { value: 'bg', label: 'Български' },
  { value: 'hr', label: 'Hrvatski' },
  { value: 'sk', label: 'Slovenčina' },
  { value: 'sl', label: 'Slovenščina' },
  { value: 'sr', label: 'Srpski' },
  { value: 'cy', label: 'Cymraeg' },
  { value: 'fa', label: 'فارسی' },
];

const MODEL_OPTIONS = [
  { value: 'tiny-int8', label: 'tiny-int8 (~75MB RAM)' },
  { value: 'base-int8', label: 'base-int8 (~200MB RAM)' },
  { value: 'small-int8', label: 'small-int8 (~500MB RAM)' },
  { value: 'medium', label: 'medium (~1.5GB RAM)' },
];

function StatusDot({ available }: { available: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.75rem',
        color: available ? 'var(--success)' : 'var(--error)',
      }}
    >
      {available ? <CheckCircle size={14} /> : <XCircle size={14} />}
      {available ? 'Running' : 'Offline'}
    </span>
  );
}

export function VoiceSection() {
  // Lifecycle state from store (updated via WS events globally in Shell)
  const sttState = useServiceState('wyoming-whisper');
  const ttsState = useServiceState('wyoming-piper');
  const sttAvailable = sttState === 'running';
  const ttsAvailable = ttsState === 'running';
  const fetchServices = useServicesStore((s) => s.fetchServices);
  const storeStartService = useServicesStore((s) => s.startService);
  const storeStopService = useServicesStore((s) => s.stopService);

  // Local "request in flight" state — provides immediate feedback before WS events arrive
  const [startingSTT, setStartingSTT] = useState(false);
  const [startingTTS, setStartingTTS] = useState(false);
  const [stoppingSTT, setStoppingSTT] = useState(false);
  const [stoppingTTS, setStoppingTTS] = useState(false);

  const [activeVoice, setActiveVoice] = useState('es_ES-davefx-medium');
  const [testingSTT, setTestingSTT] = useState(false);
  const [testingTTS, setTestingTTS] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [model, setModel] = useState('base-int8');
  const [language, setLanguage] = useState('auto');
  const [savingConfig, setSavingConfig] = useState<string | null>(null);
  const getToken = useCallback(() => useAuthStore.getState().tokens?.accessToken ?? '', []);
  const voiceSettings = useSettingsStore((s) => s.settings?.voice);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const fetchWithTimeout = useCallback((url: string, opts?: RequestInit, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
  }, []);

  // Clear local "in-flight" flags when store state catches up
  useEffect(() => {
    if (sttState === 'running' || sttState === 'failed') setStartingSTT(false);
    if (sttState === 'stopped' || sttState === 'failed') setStoppingSTT(false);
  }, [sttState]);
  useEffect(() => {
    if (ttsState === 'running' || ttsState === 'failed') setStartingTTS(false);
    if (ttsState === 'stopped' || ttsState === 'failed') setStoppingTTS(false);
  }, [ttsState]);

  const voiceOptions = useMemo(() => {
    const grouped = new Map<string, typeof PIPER_VOICES>();
    for (const voice of PIPER_VOICES) {
      const lang = voice.locale.split('_')[0] ?? voice.locale;
      const list = grouped.get(lang) ?? [];
      list.push(voice);
      grouped.set(lang, list);
    }

    const options: Array<{ value: string; label: string }> = [];
    const sortedLangs = [...grouped.keys()].sort((a, b) => {
      const nameA = LANGUAGE_NAMES[a] ?? a;
      const nameB = LANGUAGE_NAMES[b] ?? b;
      return nameA.localeCompare(nameB);
    });

    for (const lang of sortedLangs) {
      const voices = grouped.get(lang) ?? [];
      for (const voice of voices) {
        const langName = LANGUAGE_NAMES[lang] ?? lang;
        const region = voice.locale.split('_')[1] ?? '';
        options.push({
          value: voice.id,
          label: `${langName} (${region}) — ${voice.speaker} [${voice.quality}]`,
        });
      }
    }
    return options;
  }, []);

  // Fetch config + ensure services store is populated on mount
  useEffect(() => {
    fetchServices();

    const headers = { Authorization: `Bearer ${getToken()}` };
    fetchWithTimeout(`${API}/voice/config`, { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          if (json.data.voice) setActiveVoice(json.data.voice);
          if (json.data.model) setModel(json.data.model);
          if (json.data.language) setLanguage(json.data.language);
        }
      })
      .catch(() => { /* keep defaults */ });
  }, [getToken, fetchWithTimeout, fetchServices]);

  const handleSaveConfig = useCallback(async (field: string, value: string) => {
    setSavingConfig(field);
    try {
      const res = await fetchWithTimeout(`${API}/voice/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      }, 120000);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.data) {
        if (json.data.voice) setActiveVoice(json.data.voice);
        if (json.data.model) setModel(json.data.model);
        if (json.data.language) setLanguage(json.data.language);
      }
      toast.success('Voice config updated');
      // No polling needed — lifecycle WS events update the store automatically
    } catch (err) {
      toast.error(`Failed to update ${field}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setSavingConfig(null);
  }, [getToken, fetchWithTimeout]);

  const handleStartService = useCallback(async (service: 'stt' | 'tts') => {
    const name = service === 'stt' ? 'wyoming-whisper' : 'wyoming-piper';
    const label = service === 'stt' ? 'Whisper (STT)' : 'Piper (TTS)';
    const setStarting = service === 'stt' ? setStartingSTT : setStartingTTS;

    setStarting(true);
    try {
      // Store does optimistic update (state → 'starting') + POST + fetchServices on completion
      await storeStartService(name);
      toast.success(`${label} is running`);
    } catch (err) {
      toast.error(`Failed to start ${label}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setStarting(false);
  }, [storeStartService]);

  const handleStopService = useCallback(async (service: 'stt' | 'tts') => {
    const name = service === 'stt' ? 'wyoming-whisper' : 'wyoming-piper';
    const label = service === 'stt' ? 'Whisper (STT)' : 'Piper (TTS)';
    const setStopping = service === 'stt' ? setStoppingSTT : setStoppingTTS;

    setStopping(true);
    try {
      // Store does POST + fetchServices on completion
      await storeStopService(name);
      toast.success(`${label} stopped`);
    } catch (err) {
      toast.error(`Failed to stop ${label}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setStopping(false);
  }, [storeStopService]);

  const handleTestSTT = useCallback(async () => {
    setTestingSTT(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const stopped = new Promise<void>((r) => { recorder.onstop = () => r(); });
      recorder.start(500); // emit chunks every 500ms so ondataavailable fires during recording
      await new Promise((r) => setTimeout(r, 3000));
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());

      await stopped;
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const form = new FormData();
      form.append('file', blob, 'test.webm');

      const res = await fetch(`${API}/voice/stt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const json = await res.json();
      toast.success(`STT: "${json.data?.text || '(empty)'}"`);
    } catch {
      toast.error('STT test failed');
    }
    setTestingSTT(false);
  }, [getToken]);

  const handleTestTTS = useCallback(async () => {
    setTestingTTS(true);
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'Hola, soy tu asistente de voz.' }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = speed;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      toast.success('TTS playback started');
    } catch {
      toast.error('TTS test failed');
    }
    setTestingTTS(false);
  }, [getToken, speed]);

  const renderStatusRow = (
    service: 'stt' | 'tts',
    state: string | null,
    isStarting: boolean,
    isStopping: boolean,
  ) => {
    // Combine store state (from WS) with local in-flight state for immediate feedback
    const available = state === 'running';
    const starting = state === 'starting' || isStarting;
    const stopping = state === 'draining' || isStopping;
    const busy = starting || stopping;

    return (
      <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {starting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--amber)' }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Starting...
              </span>
            ) : stopping ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Stopping...
              </span>
            ) : (
              <StatusDot available={available} />
            )}
            {!available && !busy && (
              <button
                onClick={() => handleStartService(service)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', fontSize: '0.7rem', fontFamily: 'var(--font-sans)',
                  background: 'var(--success)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}
              >
                <Power size={10} />
                Start
              </button>
            )}
            {available && !busy && (
              <button
                onClick={() => handleStopService(service)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', fontSize: '0.7rem', fontFamily: 'var(--font-sans)',
                  background: 'var(--surface-hover)', color: 'var(--text-dim)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}
              >
                <Square size={10} />
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* STT Section */}
      <SettingSection
        title="Speech-to-Text (STT)"
        description="Transcribe spoken audio to text using Wyoming Whisper."
        action={
          <button
            onClick={handleTestSTT}
            disabled={testingSTT || !sttAvailable}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: 'var(--surface-hover)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              cursor: testingSTT || !sttAvailable ? 'not-allowed' : 'pointer',
              opacity: testingSTT || !sttAvailable ? 0.5 : 1,
            }}
          >
            <Mic size={12} />
            {testingSTT ? 'Recording...' : 'Test STT'}
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Engine</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Wyoming Whisper (local)</span>
        </div>
        {renderStatusRow('stt', sttState, startingSTT, stoppingSTT)}
        <SettingSelect
          label="Model"
          description="Larger models are more accurate but use more RAM."
          value={model}
          options={MODEL_OPTIONS}
          onChange={(v) => { setModel(v); handleSaveConfig('model', v); }}
          disabled={savingConfig === 'model' || startingSTT || sttState === 'starting'}
        />
        <SettingSelect
          label="Language"
          value={language}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => { setLanguage(v); handleSaveConfig('language', v); }}
          disabled={savingConfig === 'language' || startingSTT || sttState === 'starting'}
        />
      </SettingSection>

      {/* TTS Section */}
      <SettingSection
        title="Text-to-Speech (TTS)"
        description="Generate spoken audio from text using Wyoming Piper."
        action={
          <button
            onClick={handleTestTTS}
            disabled={testingTTS || !ttsAvailable}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: 'var(--surface-hover)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              cursor: testingTTS || !ttsAvailable ? 'not-allowed' : 'pointer',
              opacity: testingTTS || !ttsAvailable ? 0.5 : 1,
            }}
          >
            <Volume2 size={12} />
            {testingTTS ? 'Playing...' : 'Test TTS'}
          </button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Engine</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>Wyoming Piper (local)</span>
        </div>
        {renderStatusRow('tts', ttsState, startingTTS, stoppingTTS)}
        <SettingSelect
          label="Voice"
          description="Changing voice will restart the TTS container."
          value={activeVoice}
          options={voiceOptions}
          onChange={(v) => { setActiveVoice(v); handleSaveConfig('voice', v); }}
          disabled={savingConfig === 'voice' || startingTTS || ttsState === 'starting'}
        />
        {savingConfig === 'voice' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--amber)', padding: '8px 0' }}>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            Downloading voice and restarting container...
          </div>
        )}
        {/* Speed slider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Speed</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Playback speed for TTS audio.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range" min={0.5} max={2.0} step={0.1} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ width: 100, accentColor: 'var(--amber)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'right' }}>
              {speed.toFixed(1)}x
            </span>
          </div>
        </div>
      </SettingSection>

      {/* Voice Mode */}
      <SettingSection title="Voice Mode" description="Hold Space or click the mic button to record.">
        <SettingToggle
          label="Auto-play responses"
          description="Automatically play TTS for agent responses."
          checked={voiceSettings?.autoplay_responses ?? false}
          onChange={(v) => {
            setLocalValue('voice.autoplay_responses', v);
            updateSection('voice', { ...voiceSettings, autoplay_responses: v }).catch(() => toast.error('Failed to save setting'));
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Keyboard shortcut</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Hold Space to record (when not typing).</div>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', padding: '2px 8px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            Space
          </span>
        </div>
      </SettingSection>
    </>
  );
}
