const FILE_DOMAIN = 'file';

export interface SearchRouteState {
  query: string;
  domains: string[];
}

/** Build the canonical Search route used by Drive's "all files" action. */
export function buildAllFilesSearchRoute(query: string): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  params.set('domains', FILE_DOMAIN);
  return `/search?${params.toString()}`;
}

/** Read URL-owned search state so a stale Zustand session cannot change scope. */
export function readSearchRouteState(params: URLSearchParams): SearchRouteState {
  const domains = (params.get('domains') ?? '')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);

  return {
    query: params.get('q') ?? '',
    domains,
  };
}
