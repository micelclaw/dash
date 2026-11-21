import {readPending} from './pending-progress';
export const steps = ['domain', 'preferences', 'users', 'integrations', 'applications', 'summary'] as const;
export type SetupStep = typeof steps[number];
export interface SetupProgress { version: 1; welcome_note_id?:string; step: SetupStep; skipped: SetupStep[]; paused: boolean; selections: string[] }
export const emptyProgress = (): SetupProgress => ({version: 1, step: 'domain', skipped: [], paused: false, selections: []});
export function normalizeProgress(p: SetupProgress | (Omit<SetupProgress,'step'|'skipped'>&{step:string;skipped:string[]})):SetupProgress {return {...p,step:p.step==='ai'?'integrations':steps.includes(p.step as SetupStep)?p.step as SetupStep:'domain',skipped:(p.skipped as readonly string[]).filter((s):s is SetupStep=>steps.includes(s as SetupStep))};}
export const progressKey = (origin: string, id: string) => `micelclaw-initial-setup-v1:${origin}:${id}`;
const validSelection = (s: unknown): s is string => typeof s === 'string' && /^(google|microsoft):[a-z][a-z0-9_-]{1,49}$/.test(s);
export function readProgress(origin: string, id: string): SetupProgress | null {
  try { const p = JSON.parse(localStorage.getItem(progressKey(origin, id)) ?? 'null');
    if (!p || p.version !== 1 || !([...steps,'ai'] as string[]).includes(p.step) || !Array.isArray(p.skipped) || !Array.isArray(p.selections)) return null;
    return {version: 1, ...(typeof p.welcome_note_id==='string'&&/^[a-f0-9-]{36}$/i.test(p.welcome_note_id)?{welcome_note_id:p.welcome_note_id}:{}), step: p.step==='ai'?'integrations':p.step, skipped: p.skipped.filter((s: SetupStep) => steps.includes(s)), paused: p.paused === true, selections: p.selections.filter(validSelection)};
  } catch { return null; }
}
export function writeProgress(origin: string, id: string, progress: SetupProgress) {
  try { localStorage.setItem(progressKey(origin, id), JSON.stringify(progress)); return true; } catch { return false; }
}
export function initialDestination(user: {id: string; role: string} | null) {
  if (user?.role !== 'owner') return '/';
  if (readPending(window.location.origin,user.id)) return '/onboarding';
  const progress = readProgress(window.location.origin, user.id);
  return !progress || !progress.paused ? '/onboarding' : progress.welcome_note_id ? `/notes?id=${progress.welcome_note_id}` : '/';
}
export function ownOAuthCallback(uri: string | null | undefined, origin: string, allowedOrigins: readonly string[] = []) {
  if (!uri) return false;
  try { const u = new URL(uri); return (u.origin === new URL(origin).origin || allowedOrigins.includes(u.origin)) && u.pathname === '/oauth/callback' && !u.username && !u.password; } catch { return false; }
}
