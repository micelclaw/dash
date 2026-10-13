/** Dynamic provider authentication UI driven entirely by OpenClaw prompts. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import * as gatewayService from '@/services/gateway.service';
import type { CatalogProvider, ProviderAuthFlow, ProviderAuthFlowPrompt } from '../types';
import { describeCredentialError } from '../lib/credential-errors';

export function ProviderAuthWizard({ provider, onClose, onSuccess }: {
  provider: CatalogProvider;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [flow, setFlow] = useState<ProviderAuthFlow | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [answerState, setAnswerState] = useState<{ promptId: string | null; value: unknown }>({ promptId: null, value: '' });
  const onSuccessRef = useRef(onSuccess);
  const flowId = flow?.id;
  const flowStatus = flow?.status;

  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

  useEffect(() => {
    if (!flowId || flowStatus === 'completed' || flowStatus === 'failed' || flowStatus === 'cancelled') return;
    const timer = window.setInterval(() => {
      void gatewayService.getProviderAuthFlow(provider.id, flowId)
        .then((next) => {
          setFlow(next);
          if (next.status === 'completed') {
            toast.success(`${provider.label} connected`);
            onSuccessRef.current();
          }
        })
        .catch(() => { /* transient Gateway reload/poll failure: next tick retries */ });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [flowId, flowStatus, provider.id, provider.label]);

  const answer = flow?.prompt && answerState.promptId === flow.prompt.id
    ? answerState.value
    : initialPromptAnswer(flow?.prompt ?? null);
  const setAnswer = (value: unknown) => setAnswerState({ promptId: flow?.prompt?.id ?? null, value });

  const close = () => {
    if (flow && !['completed', 'failed', 'cancelled'].includes(flow.status)) {
      void gatewayService.cancelProviderAuthFlow(provider.id, flow.id).catch(() => {});
    }
    onClose();
  };

  const start = async (method: string) => {
    setStarting(method);
    try {
      setFlow(await gatewayService.startProviderAuthFlow(provider.id, method));
    } catch (error) {
      toast.error(describeCredentialError(error, `Could not start ${provider.label} authentication`));
    } finally {
      setStarting(null);
    }
  };

  const submitAnswer = async () => {
    if (!flow?.prompt) return;
    setAnswering(true);
    try {
      setFlow(await gatewayService.answerProviderAuthFlow(
        provider.id, flow.id, flow.prompt.id, answer,
      ));
    } catch (error) {
      toast.error(describeCredentialError(error, 'Could not submit authentication step'));
    } finally {
      setAnswering(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent style={{ width: 'min(560px, calc(100vw - 24px))', maxHeight: '85vh', overflowY: 'auto' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text)' }}>Configure {provider.label}</DialogTitle>
          <DialogDescription>
            Authentication methods and prompts are supplied by OpenClaw
            {provider.version ? ` ${provider.version}` : ''}.
          </DialogDescription>
        </DialogHeader>

        {!flow ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {provider.auth_methods.length === 0 ? (
              <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                Authentication metadata is unavailable. Reload the Gateway after the provider bridge is registered, then refresh the catalog.
              </div>
            ) : provider.auth_methods.map((method) => (
              <button
                key={method.id}
                onClick={() => { void start(method.id); }}
                disabled={starting !== null}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 12,
                  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{method.label}</div>
                  {method.hint && <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 2 }}>{method.hint}</div>}
                </div>
                {starting === method.id && <Loader2 size={15} className="spin" />}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {flow.messages.map((message) => (
              message.type === 'open_url' ? (
                <OpenUrlMessage key={message.id} message={message} />
              ) : (
                <div key={message.id} style={{ padding: 10, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                  {message.title && <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text)', marginBottom: 3 }}>{message.title}</div>}
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-dim)', fontSize: '0.75rem' }}>{message.message}</div>
                </div>
              )
            ))}

            {flow.prompt && (
              <PromptInput prompt={flow.prompt} value={answer} onChange={setAnswer} />
            )}
            {flow.status === 'running' && !flow.prompt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                <Loader2 size={14} className="spin" /> Waiting for OpenClaw…
              </div>
            )}
            {flow.status === 'failed' && (
              <div style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>{flow.error ?? 'Authentication failed'}</div>
            )}
            {flow.status === 'completed' && (
              <div style={{ color: 'var(--success)', fontSize: '0.8125rem' }}>Authentication completed.</div>
            )}
          </div>
        )}

        <DialogFooter style={{ marginTop: 18, gap: 8 }}>
          <Button variant="outline" onClick={close}>{flow?.status === 'completed' ? 'Close' : 'Cancel'}</Button>
          {flow?.prompt && (
            <Button onClick={() => { void submitAnswer(); }} disabled={answering || (flow.prompt.type === 'text' && String(answer).trim().length === 0)}>
              {answering ? <><Loader2 size={14} className="spin" /> Sending…</> : 'Continue'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpenUrlMessage({ message }: { message: ProviderAuthFlow['messages'][number] }) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => {
    try {
      const parsed = new URL(message.message);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  }, [message.message]);

  if (!url) {
    return (
      <div style={{ padding: 10, color: 'var(--error)', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
        OpenClaw returned an invalid authentication URL. Cancel and retry the flow.
      </div>
    );
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
      toast.success('Authentication URL copied');
    } catch {
      toast.error('Could not copy the authentication URL');
    }
  };

  return (
    <div style={{ padding: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text)', marginBottom: 8 }}>
        {message.title ?? 'Authentication URL'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <Button asChild size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> Open authentication page
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => { void copyUrl(); }}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy URL'}
        </Button>
      </div>
      <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', lineHeight: 1.4, wordBreak: 'break-all' }}>
        {url}
      </div>
    </div>
  );
}

function initialPromptAnswer(prompt: ProviderAuthFlowPrompt | null): unknown {
  if (!prompt) return '';
  if (prompt.type === 'confirm') return prompt.initial_value ?? false;
  if (prompt.type === 'multiselect') return Array.isArray(prompt.initial_value) ? prompt.initial_value : [];
  if (prompt.type === 'select') return prompt.initial_value ?? prompt.options[0]?.value ?? '';
  return typeof prompt.initial_value === 'string' ? prompt.initial_value : '';
}

function PromptInput({ prompt, value, onChange }: {
  prompt: ProviderAuthFlowPrompt;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const selected = useMemo(() => new Set(Array.isArray(value) ? value.map((v) => JSON.stringify(v)) : []), [value]);
  if (prompt.type === 'confirm') {
    return (
      <div>
        <div style={{ color: 'var(--text)', fontSize: '0.8125rem', marginBottom: 8 }}>{prompt.message}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant={value === true ? 'default' : 'outline'} onClick={() => onChange(true)}>Yes</Button>
          <Button variant={value === false ? 'default' : 'outline'} onClick={() => onChange(false)}>No</Button>
        </div>
      </div>
    );
  }
  if (prompt.type === 'select' || prompt.type === 'multiselect') {
    return (
      <div>
        <div style={{ color: 'var(--text)', fontSize: '0.8125rem', marginBottom: 8 }}>{prompt.message}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prompt.options.map((option, index) => {
            const key = JSON.stringify(option.value);
            const checked = prompt.type === 'multiselect' ? selected.has(key) : JSON.stringify(value) === key;
            return (
              <label key={`${key}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                <input
                  type={prompt.type === 'multiselect' ? 'checkbox' : 'radio'}
                  checked={checked}
                  onChange={() => {
                    if (prompt.type === 'select') onChange(option.value);
                    else {
                      const current = Array.isArray(value) ? value : [];
                      onChange(checked
                        ? current.filter((v) => JSON.stringify(v) !== key)
                        : [...current, option.value]);
                    }
                  }}
                />
                <span>
                  <span style={{ display: 'block', color: 'var(--text)', fontSize: '0.8125rem' }}>{option.label}</span>
                  {option.hint && <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{option.hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ color: 'var(--text)', fontSize: '0.8125rem' }}>{prompt.message}</span>
      <Input
        type={prompt.sensitive ? 'password' : 'text'}
        autoComplete={prompt.sensitive ? 'off' : undefined}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        autoFocus
      />
    </label>
  );
}
