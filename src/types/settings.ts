export interface Settings {
  general: {
    language: string;
    timezone: string;
    date_format: string;
    time_format: string;
    default_search_mode: 'auto' | 'fulltext' | 'semantic';
  };
  ai: {
    default_model: string;
    payment_method: 'byok' | 'credits';
    auto_routing: boolean;
    api_keys: Record<string, { configured: boolean; last_4: string }>;
    local_models: {
      ollama_url: string;
      ollama_status: 'connected' | 'disconnected' | 'error';
      available_models: string[];
      embedding_model: string;
      multimodal_model: string;
    };
  };
  sync: {
    enabled_connectors: string[];
    default_interval_minutes: number;
  };
  storage: {
    data_path: string;
    files_path: string;
    backup_path: string;
    hal_enabled: boolean;
    claw_domain: string;
    snapshots: {
      enabled: boolean;
      max_versions_per_file: number;
      rotation_policy: 'smart' | 'fifo' | 'none';
      excluded_patterns: string[];
      excluded_folders: string[];
    };
  };
  photos: {
    include_attachments_in_timeline: boolean;
    max_guest_uploads_per_ip_day: number;
    ai_worker: {
      enabled: boolean;
      paused: boolean;
      rate_limit: number;
      face_recognition: boolean;
      face_threshold: number;
    };
  };
  mail: {
    default_account_id: string | null;
    require_send_confirmation: boolean;
    signature_position: 'below_reply' | 'bottom';
    check_interval_minutes: number;
    max_sync_emails_initial: number;
    snooze_default_options: Array<{ label: string; relative: string }>;
  };
  dash: {
    theme: 'dark' | 'light' | 'midnight' | 'ember' | 'moss' | 'lucid';
    accent_color: string;
    sidebar_collapsed: boolean;
    default_module: string;
  };
  notifications: {
    toast_position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    toast_duration_ms: number;
    sound_enabled: boolean;
    show_digest_toasts: boolean;
    show_sync_toasts: boolean;
  };
  calendar: {
    first_day_of_week: 0 | 1;
    default_view: 'day' | 'week' | 'month' | 'agenda';
    working_hours_start: string;
    working_hours_end: string;
    default_reminder_minutes: number | null;
  };
}

export interface SecurityConfig {
  unrestricted_shell: boolean;
  approval_timeouts: {
    reminder_minutes: number;
    escalation_minutes: number;
    expiry_minutes: number;
  };
  approval_levels: Record<string, number>;
  pin_configured: boolean;
  operation_defaults: OperationLevelDefinition[];
}

export interface OperationLevelDefinition {
  operation: string;
  label: string;
  default_level: number;
  min_level: number;
  edit_role: 'owner' | 'admin' | 'user';
}

export interface ApprovalRequest {
  id: string;
  user_id: string;
  requested_by: string;
  operation: string;
  level: number;
  summary: string;
  params: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  channel: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  pin_verified: boolean;
  expires_at: string;
  created_at: string;
}

export interface SyncConnector {
  id: string;
  provider: string;
  account_name: string;
  status: 'active' | 'error' | 'disabled';
  last_sync_at: string | null;
  error_message: string | null;
}
