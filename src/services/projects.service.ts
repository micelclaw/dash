import { api } from './api';

export interface DetachedTaskBoard {
  board_id: string;
  connector_id: string;
  remote_collection_id: string;
  remote_deleted: false;
}

export async function detachTaskBoard(boardId: string): Promise<DetachedTaskBoard> {
  const res = await api.post<{ data: DetachedTaskBoard }>(`/projects/boards/${boardId}/detach-sync`);
  return res.data;
}
