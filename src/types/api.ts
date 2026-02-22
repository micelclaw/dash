/** Envelope for single record */
export interface ApiResponse<T> {
  data: T;
  tier?: 'free' | 'pro';
}

/** Envelope for lists */
export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
  tier?: 'free' | 'pro';
}
