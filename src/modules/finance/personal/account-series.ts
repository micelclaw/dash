/** Parámetros exactos que el store serializa para el endpoint multi-línea. */
export function buildAccountSeriesParams(opts?: { from?: string; to?: string }): Record<string, string> | undefined {
  if (!opts) return undefined;
  const params: Record<string, string> = {};
  if (opts.from) params.from = opts.from;
  if (opts.to) params.to = opts.to;
  return Object.keys(params).length > 0 ? params : undefined;
}

export interface AccountSeriesHttpClient {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
}

/** Camino usado por el store: serializa rango, llama al endpoint y extrae el envelope. */
export async function fetchAccountSeriesData<T>(
  client: AccountSeriesHttpClient,
  opts?: { from?: string; to?: string },
): Promise<T> {
  const response = await client.get<{ data: T }>('/finance/summary/account-series', buildAccountSeriesParams(opts));
  return response.data;
}

/** Acción inyectable que producción y tests comparten; evita duplicar el wiring del store. */
export function createFetchAccountSeries<T>(client: AccountSeriesHttpClient) {
  return (opts?: { from?: string; to?: string }): Promise<T> => fetchAccountSeriesData<T>(client, opts);
}
