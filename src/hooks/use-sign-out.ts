import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { hasNativeAccessReset, nativeResetAccess } from '@/lib/native-session';

/** All explicit sign-out surfaces share remote acknowledgement before local reset. */
export function useSignOut() {
  const navigate = useNavigate();
  const state = useAuthStore(s => s.logoutState);
  const error = useAuthStore(s => s.logoutError);
  const signOut = async () => {
    try {
      await useAuthStore.getState().logout();
      if (useAuthStore.getState().isAuthenticated) return false;
      const native = hasNativeAccessReset();
      const reset = nativeResetAccess();
      if (native && !reset) toast.error('Sesión revocada. No se pudo restablecer el acceso nativo; reintenta desde la aplicación.');
      if (!reset) navigate('/login', { replace: true });
      return true;
    } catch {
      toast.error(useAuthStore.getState().logoutError ?? 'No se confirmó el cierre remoto. Reintenta.');
      return false;
    }
  };
  return { signOut, revoking: state === 'revoking', error };
}
