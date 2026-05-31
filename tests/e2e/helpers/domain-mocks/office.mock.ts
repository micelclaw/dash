import type { MockRoute } from '../api-spy';

const DOC_1 = {
  id: 'doc-1',
  filename: 'report.docx',
  mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size: 10240,
  size_bytes: 10240,
  filepath: '/Documents/report.docx',
  parent_folder: '/Documents',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

export const FILES_LIST = [DOC_1];

export const officeMocks: MockRoute[] = [
  // Office status
  {
    method: 'GET',
    path: '/office/status',
    response: {
      data: {
        onlyoffice: { running: false },
        stirling_pdf: { running: false },
        documenso: { running: false },
      },
    },
  },
  // List files
  {
    method: 'GET',
    path: '/files',
    response: { data: FILES_LIST, meta: { total: 1, limit: 50, offset: 0 } },
  },
  // Get single file
  {
    method: 'GET',
    path: '/files/*',
    response: { data: DOC_1 },
  },
  // Start OnlyOffice
  {
    method: 'POST',
    path: '/office/start/onlyoffice',
    response: { data: { status: 'running', url: 'http://localhost:8080' } },
  },
  // Start Stirling PDF
  {
    method: 'POST',
    path: '/office/start/stirling-pdf',
    response: { data: { status: 'running', url: 'http://localhost:8081' } },
  },
  // Update file
  {
    method: 'PATCH',
    path: '/files/*',
    response: { data: { ...DOC_1, updated_at: new Date().toISOString() } },
  },
  // Delete file
  {
    method: 'DELETE',
    path: '/files/*',
    status: 204,
    response: null,
  },
];
