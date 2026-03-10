import { Clapperboard } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="jellyfin" displayName="Jellyfin" description="Media Server" port={8096} icon={Clapperboard} color="#a855f7" />;
}
