import assert from 'node:assert/strict';
import test from 'node:test';
import {
  breakGlassLeasePresentation,
  evaluateDeliverySelection,
  resolveObservedRuntimeHealth,
} from './security-policy.ui-state.ts';

test('runtime health never treats transport-only observations as healthy', () => {
  assert.equal(resolveObservedRuntimeHealth({ status: 'observed', guard: 'healthy' }), 'healthy');
  assert.equal(resolveObservedRuntimeHealth({ status: 'available' }), 'unavailable');
  assert.equal(resolveObservedRuntimeHealth({ status: 'unexpected', guard: 'degraded' }), 'degraded');
  assert.equal(resolveObservedRuntimeHealth({ status: 'unhealthy', guard: 'healthy' }), 'unhealthy');
});

test('external delivery needs an available selected destination when enabled', () => {
  const destinations = [
    { id: 'available', available: true },
    { id: 'stale', available: false },
  ];
  assert.equal(evaluateDeliverySelection({
    enabled: true,
    authorityCount: 1,
    destinationIds: [],
    destinations,
  }).invalid, true);
  assert.equal(evaluateDeliverySelection({
    enabled: true,
    authorityCount: 1,
    destinationIds: ['stale'],
    destinations,
  }).hasUnavailableSelection, true);
  assert.equal(evaluateDeliverySelection({
    enabled: true,
    authorityCount: 1,
    destinationIds: ['available'],
    destinations,
  }).invalid, false);
});

test('break-glass effectiveness is consumed only from the Core boolean', () => {
  assert.deepEqual(
    breakGlassLeasePresentation({ status: 'active', effective: false }),
    { effective: false, revocable: true },
  );
  assert.deepEqual(
    breakGlassLeasePresentation({ status: 'revoked', effective: true }),
    { effective: true, revocable: false },
  );
});
