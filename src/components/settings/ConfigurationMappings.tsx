import type { ConfigurationMapping, ConfigurationMappingKind, ConfigurationMappingRequest } from '@/services/configuration.service';

const labels: Record<ConfigurationMappingKind, string> = {
  user: 'Usuario', group: 'Grupo', agent: 'Agente', connection: 'Conexión', application: 'Aplicación',
  dns_provider: 'Proveedor DNS', ddns_provider: 'Proveedor DDNS', dns_zone: 'Zona DNS', system_domain: 'Dominio del sistema',
  proxy_host: 'Host del proxy', proxy_certificate: 'Certificado del proxy',
  proxy_access_list: 'Lista de acceso del proxy', vpn_peer: 'Par VPN',
  security_command_profile: 'Perfil de ejecución', security_command_profile_version: 'Versión del perfil',
  security_tool_profile: 'Perfil de herramientas',
  email_account: 'Cuenta de correo', sync_connector: 'Conector de sincronización', oauth_credential: 'Autorización OAuth',
  approval_destination: 'Destino de aprobaciones',
  dns_native_zone: 'Zona DNS existente del proveedor',
  avatar_resource: 'Avatar actual de la cuenta destino',
  shared_folder_resource: 'Carpeta compartida destino',
  vfs_mount: 'Montaje de destino',
  protection_job: 'Trabajo de protección destino',
  storage_pool: 'Pool de destino',
  storage_dataset: 'Dataset o volumen de destino',
  observer_channel: 'Canal ya seleccionado por el propietario destino',
  channel_binding: 'Cuenta de canal vinculada al propietario destino',
  native_mcp_server: 'Servidor MCP nativo configurado en el destino',
};
export function ConfigurationMappings({ requests, mappings, disabled, onChange }: {
  requests: ConfigurationMappingRequest[];
  mappings: ConfigurationMapping[];
  disabled: boolean;
  onChange(kind: ConfigurationMappingKind, sourceId: string, targetId: string): void;
}) {
  if (!requests.length && !mappings.length) return null;
  return <div className="mt-4 rounded border border-[var(--border)] p-3">
    <p className="text-sm font-medium">Correspondencias entre origen y destino</p>
    <p className="mt-1 text-xs text-[var(--text-muted)]">Elige expresamente los destinos de estas referencias y actualiza la previsualización para comprobarlos.</p>
    <div className="mt-3 space-y-3">{requests.map((request, index) => {
      const id = `configuration-mapping-${index}`;
      const selected = mappings.find(mapping => mapping.kind === request.kind && mapping.source_id === request.source_id)?.target_id ?? '';
      const candidates = request.candidates.filter(candidate => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(candidate.id));
      return <div key={`${request.kind}:${request.source_id}`}>
        <label htmlFor={id} className="block text-sm">{labels[request.kind]} · {request.source_label ?? request.source_id}{request.required && <span className="ml-2 text-xs text-[var(--text-muted)]">Necesaria</span>}</label>
        <p className="my-1 text-xs text-[var(--text-muted)]">{request.message}</p>
        <select id={id} value={selected} disabled={disabled || !candidates.length} className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm" onChange={event => onChange(request.kind, request.source_id, event.target.value)}>
          <option value="">Sin asignar</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
        </select>
        {!candidates.length && <p className="mt-1 text-xs text-[var(--text-muted)]">No hay destinos disponibles. Resuelve la referencia desde su sección y vuelve a previsualizar.</p>}
      </div>;
    })}</div>
    {mappings.filter(mapping => !requests.some(request => request.kind === mapping.kind && request.source_id === mapping.source_id)).map(mapping => <p key={`${mapping.kind}:${mapping.source_id}`} className="mt-2 text-xs text-[var(--text-muted)]">{labels[mapping.kind]} · {mapping.source_id} → {mapping.target_id}</p>)}
  </div>;
}
