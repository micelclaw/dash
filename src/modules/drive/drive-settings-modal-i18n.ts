export const driveSettingsModalMessages = {
  en: {
    'drive.settingsModal.title': 'Drive snapshot settings',
    'drive.settingsModal.close': 'Close Drive snapshot settings',
    'drive.settingsModal.cancel': 'Cancel',
    'drive.settingsModal.reconcile.title': 'Resynchronize with disk',
    'drive.settingsModal.reconcile.description': 'Reindex files added outside Drive (WebDAV, network) and remove entries without a file',
    'drive.settingsModal.reconcile.busy': 'Resynchronizing…',
    'drive.settingsModal.reconcile.action': 'Resynchronize',
    'drive.settingsModal.reconcile.toastSuccess': 'Drive resynchronized: {created} indexed, {removed} stale entries removed, {fixed} paths corrected',
    'drive.settingsModal.reconcile.toastFailure': 'Could not resynchronize',
  },
  es: {
    'drive.settingsModal.title': 'Ajustes de instantáneas de Drive',
    'drive.settingsModal.close': 'Cerrar los ajustes de instantáneas de Drive',
    'drive.settingsModal.cancel': 'Cancelar',
    'drive.settingsModal.reconcile.title': 'Resincronizar con el disco',
    'drive.settingsModal.reconcile.description': 'Reindexa archivos añadidos por fuera de Drive (WebDAV o red) y elimina entradas sin archivo',
    'drive.settingsModal.reconcile.busy': 'Resincronizando…',
    'drive.settingsModal.reconcile.action': 'Resincronizar',
    'drive.settingsModal.reconcile.toastSuccess': 'Drive resincronizado: {created} indexados, {removed} entradas obsoletas eliminadas, {fixed} rutas corregidas',
    'drive.settingsModal.reconcile.toastFailure': 'No se pudo resincronizar',
  },
} as const;
