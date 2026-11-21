import type { Messages } from '@/i18n';

export const driveQuotaMessages: Messages = {
  en: {
    'drive.quota.title': 'Storage usage',
    'drive.quota.used': 'used',
    'drive.quota.buttonLabel': 'Storage used: {size}',
    'drive.quota.filesFolders': '{files} files · {folders} folders',
    'drive.quota.byType': 'By type',
    'drive.quota.noFiles': 'No files yet',
    'drive.quota.duplicateWaste.one': '{size} wasted in {count} duplicate group',
    'drive.quota.duplicateWaste.other': '{size} wasted in {count} duplicate groups',
  },
  es: {
    'drive.quota.title': 'Uso del almacenamiento',
    'drive.quota.used': 'usados',
    'drive.quota.buttonLabel': 'Espacio utilizado: {size}',
    'drive.quota.filesFolders': '{files} archivos · {folders} carpetas',
    'drive.quota.byType': 'Por tipo',
    'drive.quota.noFiles': 'Aún no hay archivos',
    'drive.quota.duplicateWaste.one': '{size} ocupados en {count} grupo duplicado',
    'drive.quota.duplicateWaste.other': '{size} ocupados en {count} grupos duplicados',
  },
};
