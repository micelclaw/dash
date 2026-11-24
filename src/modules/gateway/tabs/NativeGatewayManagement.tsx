import { NativeOpenclawHost } from '@/components/openclaw/NativeOpenclawHost';
import { useAuthStore } from '@/stores/auth.store';
import { NATIVE_HOST_ADAPTER_DIGEST, type NativeHostTarget } from '@/services/openclaw-host-bridge';

const resolveSessions = async (): Promise<NativeHostTarget> => ({ surface: 'sessions' });
const resolveAutomations = async (): Promise<NativeHostTarget> => ({ surface: 'automations' });

export function NativeGatewayManagement({ surface }: { surface: 'sessions' | 'automations' }) {
  const sessions = surface === 'sessions';
  const role = useAuthStore((state) => state.user?.role);
  if (!sessions && role !== 'admin' && role !== 'owner') {
    return <p role="status" className="p-6 text-sm text-muted-foreground">
      La gestión de automatizaciones requiere permisos de administrador en esta versión.
    </p>;
  }
  return <NativeOpenclawHost
    artifactDigest={NATIVE_HOST_ADAPTER_DIGEST}
    title={sessions ? 'Sesiones nativas de Gateway' : 'Automatizaciones nativas de Gateway'}
    resolveTarget={sessions ? resolveSessions : resolveAutomations}
  />;
}
