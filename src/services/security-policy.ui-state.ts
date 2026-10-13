/**
 * Pure UI decisions for the unified security control plane.
 *
 * Keeping these rules outside React makes the fail-closed presentation
 * independently testable. None of these helpers manufactures runtime facts:
 * they only classify fields returned by Core.
 */

export type ObservedSecurityRuntimeHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unavailable';

const RUNTIME_HEALTH = new Set<ObservedSecurityRuntimeHealth>([
  'healthy',
  'degraded',
  'unhealthy',
  'unavailable',
]);

function isRuntimeHealth(value: unknown): value is ObservedSecurityRuntimeHealth {
  return typeof value === 'string' && RUNTIME_HEALTH.has(value as ObservedSecurityRuntimeHealth);
}

export function resolveObservedRuntimeHealth(runtime: {
  status?: unknown;
  guard?: unknown;
}): ObservedSecurityRuntimeHealth {
  if (isRuntimeHealth(runtime.status)) return runtime.status;
  if (isRuntimeHealth(runtime.guard)) return runtime.guard;
  // `observed`, `available` and unknown values only describe transport. They
  // are not proof that enforcement is healthy.
  return 'unavailable';
}

export interface DeliverySelectionDestination {
  id: string;
  available: boolean;
}

export function evaluateDeliverySelection(input: {
  enabled: boolean;
  authorityCount: number;
  destinationIds: string[];
  destinations: DeliverySelectionDestination[];
}) {
  const availableIds = new Set(
    input.destinations.filter((destination) => destination.available).map((destination) => destination.id),
  );
  const selectedAvailableCount = input.destinationIds.filter((id) => availableIds.has(id)).length;
  const hasUnavailableSelection = input.destinationIds.some((id) => !availableIds.has(id));
  const invalidAuthorities = input.authorityCount === 0;
  const missingEnabledDestination = input.enabled && selectedAvailableCount === 0;
  return {
    availableDestinationCount: availableIds.size,
    selectedAvailableDestinationCount: selectedAvailableCount,
    hasUnavailableSelection,
    invalidAuthorities,
    missingEnabledDestination,
    invalid: invalidAuthorities || missingEnabledDestination || hasUnavailableSelection,
  };
}

export type PresentedBreakGlassStatus =
  | 'pending_application'
  | 'active'
  | 'application_failed'
  | 'revoked'
  | 'expired';

export function breakGlassLeasePresentation(input: {
  status: PresentedBreakGlassStatus;
  effective: boolean;
}) {
  return {
    // Core is the sole source of this attested result. Status or timestamps
    // must never be used by Dash to infer effectiveness.
    effective: input.effective === true,
    revocable:
      input.status === 'pending_application'
      || input.status === 'active'
      || input.status === 'application_failed',
  };
}
