import type { DeleteConnectorOptions } from '../../../../services/connector-delete-request';

export function observerDisconnectTarget(id: string, sharedHub: boolean) {
  return {
    id,
    title: sharedHub ? 'Disconnect shared hub?' : 'Disconnect channel?',
    label: sharedHub ? 'Disconnect hub' : 'Disconnect',
    description: sharedHub
      ? 'This removes the shared observer for ALL platforms using this hub, not just this platform. Observed messages already in your inbox are kept. This does not log out the bridge accounts.'
      : 'The observer and its stored config will be removed. Observed messages already in your inbox are kept.',
    options: { ...(sharedHub ? { scope: 'hub' as const } : {}), keepData: true } satisfies DeleteConnectorOptions,
  };
}
