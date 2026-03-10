import { Tv } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="sonarr" displayName="Sonarr" description="TV Series Automation" port={8989} icon={Tv} color="#35c5f4" />;
}
