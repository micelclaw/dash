export interface EntityLink {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string | null;
  link_type: string;
  confidence: number;
  strength: number | null;
  heat_edge: number;
  created_by: 'user' | 'llm' | 'system';
  created_at: string;
}

/** A resolved linked record with enough info to display */
export interface LinkedRecord {
  link: EntityLink;
  domain: string;
  record: {
    id: string;
    title: string;
    subtitle?: string;
    route: string;
  };
}
