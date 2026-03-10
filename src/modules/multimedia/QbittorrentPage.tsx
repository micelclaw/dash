import { Download } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="qbittorrent" displayName="qBittorrent" description="Torrent Client" port={8085} icon={Download} color="#2196f3" />;
}
