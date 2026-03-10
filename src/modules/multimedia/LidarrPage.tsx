import { Music } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="lidarr" displayName="Lidarr" description="Music Automation" port={8686} icon={Music} color="#1db954" />;
}
