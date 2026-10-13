import { useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import * as syncSvc from '@/services/sync.service';
import { TaskMappingStep } from './TaskMappingStep';

interface Props {
  connectorId: string;
  connectorType: string;
  mappings?: Record<string, Record<string, unknown>>;
}

const PROVIDERS = {
  'monday-tasks': 'monday',
  'jira-tasks': 'jira',
  'trello-tasks': 'trello',
} as const;

export function MappingEditor({ connectorId, connectorType, mappings = {} }: Props) {
  const provider = PROVIDERS[connectorType as keyof typeof PROVIDERS];
  const [schemas, setSchemas] = useState<syncSvc.TaskCollectionSchema[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!provider) return null;

  const open = async () => {
    setBusy(true);
    try {
      const collections = await syncSvc.getConnectorCollections(connectorId);
      const ids = collections.selected.length ? collections.selected : collections.collections.map((entry) => entry.id);
      setSchemas(await Promise.all(ids.map((id) => syncSvc.getConnectorCollectionSchema(connectorId, id))));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo leer el esquema');
    } finally { setBusy(false); }
  };

  const save = async (next: Record<string, Record<string, unknown>>) => {
    if (!window.confirm('El nuevo mapeo cambiará cómo se interpretan las tareas. ¿Guardar y resincronizar ahora?')) return;
    setBusy(true);
    try {
      await syncSvc.updateConnectorConfig(connectorId, { mappings: next });
      await syncSvc.runConnector(connectorId);
      toast.success('Mapeo guardado · resincronización iniciada');
      setSchemas(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el mapeo');
    } finally { setBusy(false); }
  };

  if (!schemas) return <Button variant="secondary" onClick={() => void open()} disabled={busy}>
    {busy ? <><Loader2 size={13} className="animate-spin" /> Leyendo esquema…</> : <><SlidersHorizontal size={13} /> Revisar mapeo</>}
  </Button>;

  return <TaskMappingStep provider={provider} schemas={schemas} initialMappings={mappings as Record<string, Record<string, string | undefined>>} busy={busy} onBack={() => setSchemas(null)} onStart={(next) => void save(next)} />;
}
