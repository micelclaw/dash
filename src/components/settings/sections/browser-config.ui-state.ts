export function privateNetworkAccessEnabled(
  ssrfPolicy: Record<string, unknown> | undefined,
): boolean {
  return ssrfPolicy?.dangerously_allow_private_network === true;
}
