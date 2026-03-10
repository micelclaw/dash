import { Music2 } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="navidrome" displayName="Navidrome" description="Music Server" port={4533} icon={Music2} color="#0ea5e9" />;
}
