import { ListPlus } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="jellyseerr" displayName="Jellyseerr" description="Media Requests" port={5055} icon={ListPlus} color="#a855f7" />;
}
