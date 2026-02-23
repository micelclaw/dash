export interface Contact {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  emails: { address: string; label: string; primary: boolean }[];
  phones: { number: string; label: string; primary: boolean }[];
  company: string | null;
  job_title: string | null;
  addresses: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    label: string;
  }[];
  notes: string | null;
  avatar_path: string | null;
  tags: string[];
  custom_fields: Record<string, unknown> | null;
  source: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface ContactCreateInput {
  display_name: string;
  first_name?: string;
  last_name?: string;
  emails?: { address: string; label: string; primary: boolean }[];
  phones?: { number: string; label: string; primary: boolean }[];
  company?: string;
  job_title?: string;
  tags?: string[];
  notes?: string;
}

export interface ContactUpdateInput {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  emails?: { address: string; label: string; primary: boolean }[];
  phones?: { number: string; label: string; primary: boolean }[];
  company?: string;
  job_title?: string;
  tags?: string[];
  notes?: string;
}
