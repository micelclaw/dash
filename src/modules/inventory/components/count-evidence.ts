export async function recordCountWithOptionalEvidence(options: {
  item_id: string;
  qty_delta: number;
  photo: File | null;
  uploaded_file_id: string | null;
  upload: (file: File) => Promise<string>;
  remember_upload: (fileId: string) => void;
  record: (body: Record<string, unknown>) => Promise<void>;
}): Promise<string | null> {
  let fileId = options.uploaded_file_id;
  if (options.photo && !fileId) {
    fileId = await options.upload(options.photo);
    options.remember_upload(fileId);
  }
  await options.record({
    item_id: options.item_id,
    type: 'count_fix',
    qty_delta: options.qty_delta,
    ...(fileId ? { doc_file_id: fileId } : {}),
  });
  return fileId;
}

export function moveEvidenceDownloadPath(docFileId: string | null | undefined): string | null {
  return docFileId ? `/api/v1/files/${docFileId}/download` : null;
}
