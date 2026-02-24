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
      llava_model: string;
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
    theme: 'dark' | 'light' | 'system';
    accent_color: string;
    sidebar_collapsed: boolean;
    default_module: string;
  };
}

export interface SecurityConfig {
  approval_enabled: boolean;
  approval_levels: {
    destructive: 'pin' | 'confirm' | 'none';
    external: 'pin' | 'confirm' | 'none';
    financial: 'pin' | 'confirm' | 'none';
    sensitive: 'pin' | 'confirm' | 'none';
  };
  pin_configured: boolean;
  session_timeout_minutes: number;
  auto_approve_trusted_skills: boolean;
}

export interface Approval {
  id: string;
  operation: string;
  description: string;
  level: number;
  requested_by: string;
  expires_at: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
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
