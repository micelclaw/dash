import { Film } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="radarr" displayName="Radarr" description="Movie Automation" port={7878} icon={Film} color="#ffc230" />;
}
