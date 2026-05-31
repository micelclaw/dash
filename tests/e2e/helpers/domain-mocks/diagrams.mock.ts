import type { MockRoute } from '../api-spy';

const DIAGRAM_FILE_1 = {
  id: 'diag-1',
  filename: 'architecture.excalidraw',
  mime_type: 'application/json',
  size: 4096,
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
  tags: ['diagram'],
  parent_folder: '/Diagrams/',
  is_directory: false,
};

const DIAGRAM_CONTENT = {
  version: '1.0.0',
  title: 'Architecture',
  description: '',
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
  settings: {
    snapToGrid: true,
    snapToGuides: true,
    gridSize: 20,
    showMinimap: true,
    showGrid: true,
    defaultEdgeType: 'smoothstep',
    connectionMode: 'loose',
    autoSave: true,
  },
};

export const DIAGRAMS_LIST = [DIAGRAM_FILE_1];

export const diagramsMocks: MockRoute[] = [
  // List diagram files
  {
    method: 'GET',
    path: '/files',
    response: { data: DIAGRAMS_LIST, meta: { total: 1, limit: 200, offset: 0 } },
  },
  // Get single diagram file (metadata)
  {
    method: 'GET',
    path: '/files/*',
    response: { data: DIAGRAM_FILE_1 },
  },
  // Get diagram file content
  {
    method: 'GET',
    path: '/files/*/content',
    response: { data: { content_text: JSON.stringify(DIAGRAM_CONTENT), file_id: 'diag-1', filename: 'architecture.excalidraw' } },
  },
  // Create diagram file
  {
    method: 'POST',
    path: '/files',
    response: {
      data: {
        id: 'diag-new',
        filename: 'Untitled.diagram',
        mime_type: 'application/vnd.claw.diagram+json',
        size: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [],
        parent_folder: '/Diagrams/',
        is_directory: false,
      },
    },
  },
  // Upload diagram file
  {
    method: 'POST',
    path: '/files/upload',
    response: {
      data: {
        id: 'diag-new',
        filename: 'Untitled.diagram',
        mime_type: 'application/vnd.claw.diagram+json',
        size: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [],
        parent_folder: '/Diagrams/',
        is_directory: false,
      },
    },
  },
  // Update diagram
  {
    method: 'PATCH',
    path: '/files/*',
    response: { data: { ...DIAGRAM_FILE_1, updated_at: new Date().toISOString() } },
  },
  // Delete diagram
  {
    method: 'DELETE',
    path: '/files/*',
    status: 204,
    response: null,
  },
  // Diagram templates (used by launcher)
  {
    method: 'GET',
    path: '/diagrams/templates',
    response: { data: [] },
  },
];
