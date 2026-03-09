export interface SearchResult {
  domain: 'note' | 'event' | 'contact' | 'email' | 'file' | 'photo' | 'diary' | 'conversation' | 'message';
  record_id: string;
  score: number;
  snippet: string;
  record: Record<string, unknown> | null;
  provenance?: {
    vector_rank: number | null;
    fulltext_rank: number | null;
    rrf_score: number | null;
    heat_boost: number | null;
    temporal_boost: number | null;
    heat_score: number | null;
    vector_score: number | null;
    fulltext_score: number | null;
    graph_score: number | null;
  };
}

export interface SearchWeights {
  semantic: number;
  fulltext: number;
  heat: number;
  graph: number;
}

export const DEFAULT_SEARCH_WEIGHTS: SearchWeights = {
  semantic: 0.25,
  fulltext: 0.25,
  heat: 0.25,
  graph: 0.25,
};
