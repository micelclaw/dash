import { Eye } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export function PhotosDejaVu() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <EmptyState
        icon={Eye}
        title="Déjà Vu"
        description="Detect visually similar photos across different moments. Coming soon."
      />
    </div>
  );
}
