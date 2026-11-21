import test from 'node:test';
import assert from 'node:assert/strict';
import { commandStatus, effectiveLease, freshTime, leaseStatus, safeSecurityText } from './security-state.ts';
import type { AgentSecurity, AgentSecurityRuntime } from '@/services/security-policy.service';
const now = Date.parse('2026-10-28T10:00:00Z');
const lease = { id: 'qa-lease', status: 'active', effective: true, guard_policy_version: 42, starts_at: new Date(now - 1000).toISOString(), expires_at: new Date(now + 1000).toISOString() } as AgentSecurity['break_glass'][number];
const runtime: AgentSecurityRuntime = { openclaw_exec: null, approvals: null, layers: [], snapshot: null, adapters: [], guard: { loaded: true, health: 'healthy', policy_version: 42, active_lease_ids: ['qa-lease'] }, managed: true, drift: { state: 'in_sync', recovery: 'none' }, desired_revision: 12, requested_mode: 'ask', effective_mode: 'ask' };
const security = { desired: { mode: 'ask', revision: 12, applied_revision: 12 }, effective: { status: 'in_sync' }, break_glass: [] } as unknown as AgentSecurity;
test('freshness rejects invalid, future and historical observations; receiving a fallback cannot repair it', () => {
  assert.equal(freshTime(new Date(now).toISOString(), now), true);
  for (const value of [null, 'not-a-time', new Date(now + 1).toISOString(), new Date(now - 15_001).toISOString()]) assert.equal(freshTime(value, now), false);
});
test('lease boolean, version, loaded guard, active ID, time and freshness must agree', () => {
  assert.equal(effectiveLease(lease, runtime, true, now), true);
  for (const guard of [{ ...runtime.guard, active_lease_ids: [] }, { ...runtime.guard, active_lease_ids: ['qa-other'] }, { ...runtime.guard, loaded: false }, { ...runtime.guard, policy_version: 43 }, { ...runtime.guard, health: 'unhealthy' }]) assert.equal(effectiveLease(lease, { ...runtime, guard }, true, now), false);
  assert.equal(effectiveLease(lease, runtime, false, now), false);
  assert.equal(effectiveLease({ ...lease, effective: false }, runtime, true, now), false);
  assert.equal(effectiveLease({ ...lease, expires_at: new Date(now - 1).toISOString() }, runtime, true, now), false);
});
test('empty or closed database records never manufacture absence proof or a green score', () => {
  assert.equal(leaseStatus(security, true).color, 'orange');
  assert.equal(leaseStatus({ ...security, break_glass: [{ ...lease, status: 'revoked' }] }, true).color, 'orange');
  assert.equal(leaseStatus({ ...security, break_glass: [lease] }, true).color, 'orange');
});
test('legitimate compilation limit remains distinct from mismatched application', () => {
  assert.equal(commandStatus(security, runtime, true).color, 'green');
  assert.equal(commandStatus({ ...security, desired: { ...security.desired, mode: 'auto' } }, runtime, true).text, 'Aplicado con límites');
  assert.equal(commandStatus(security, runtime, false).color, 'orange');
  assert.equal(commandStatus(security, { ...runtime, desired_revision: 11 }, true).color, 'orange');
});
test('diagnostics redact credential-shaped text', () => {
  assert.equal(safeSecurityText('Authorization: Bearer s06-synthetic'), 'Authorization: [oculto]');
});
