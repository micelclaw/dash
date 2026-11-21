export const diagnosticsBannerMessages = {
  en: {
    'agents.workboard.diagnostics.warningOne': '{count} warning',
    'agents.workboard.diagnostics.warningMany': '{count} warnings',
    'agents.workboard.diagnostics.kind.stranded_ready': 'ready and unclaimed',
    'agents.workboard.diagnostics.kind.running_without_heartbeat': 'running without a heartbeat',
    'agents.workboard.diagnostics.kind.blocked_too_long': 'blocked for too long',
    'agents.workboard.diagnostics.kind.repeated_failures': 'repeated failures',
    'agents.workboard.diagnostics.kind.missing_proof': 'missing proof',
    'agents.workboard.diagnostics.kind.orphaned_session': 'orphaned session',
  },
  es: {
    'agents.workboard.diagnostics.warningOne': '{count} aviso',
    'agents.workboard.diagnostics.warningMany': '{count} avisos',
    'agents.workboard.diagnostics.kind.stranded_ready': 'lista sin reclamar',
    'agents.workboard.diagnostics.kind.running_without_heartbeat': 'en curso sin heartbeat',
    'agents.workboard.diagnostics.kind.blocked_too_long': 'bloqueada demasiado tiempo',
    'agents.workboard.diagnostics.kind.repeated_failures': 'fallos repetidos',
    'agents.workboard.diagnostics.kind.missing_proof': 'falta proof',
    'agents.workboard.diagnostics.kind.orphaned_session': 'sesión huérfana',
  },
} as const;
