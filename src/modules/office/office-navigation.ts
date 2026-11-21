import type { UiModule } from '@/services/app-access.service';

/** Compatibility for the original Documents package; never a modern provider. */
export function isLegacyDocumentsModule(module: UiModule | undefined): boolean {
  return !!module && module.app_name === 'documents' && module.id === 'documents'
    && module.path === '/app/documents' && module.group === 'Files'
    && !module.parent_module && !module.office_provider;
}

export function isOfficeChildModule(module: UiModule): boolean {
  return module.parent_module === 'office' || isLegacyDocumentsModule(module);
}

export function legacyDocumentsTarget(file: string | null): string {
  return file && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(file)
    ? `/office/edit/${file}` : '/office?app=documents';
}
