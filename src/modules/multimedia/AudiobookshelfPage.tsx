import { Headphones } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="audiobookshelf" displayName="Audiobookshelf" description="Audiobook & Podcast Server" port={13378} icon={Headphones} color="#4ade80" />;
}
