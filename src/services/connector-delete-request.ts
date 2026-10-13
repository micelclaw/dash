export interface DeleteConnectorOptions {
  scope?: 'hub';
  keepData?: boolean;
}

export function connectorDeletePath(connectorId: string, options: DeleteConnectorOptions = {}) {
  const params = new URLSearchParams();
  if (options.scope) params.set('scope', options.scope);
  if (options.keepData) params.set('keep_data', '1');
  const query = params.toString();
  return `/sync/connectors/${encodeURIComponent(connectorId)}${query ? `?${query}` : ''}`;
}
