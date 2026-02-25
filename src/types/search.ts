export interface SearchResult {
  domain: 'note' | 'event' | 'contact' | 'email' | 'file' | 'diary' | 'conversation';
  record_id: string;
  score: number;
  snippet: string;
  record: Record<string, unknown> | null;
  provenance?: {
    vector_rank: number;
    fulltext_rank: number;
    rrf_score: number;
    heat_boost: number;
    temporal_boost: number;
  };
}
