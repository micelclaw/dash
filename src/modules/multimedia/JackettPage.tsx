import { Search } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="jackett" displayName="Jackett" description="Indexer Proxy" port={9117} icon={Search} color="#e74c3c" />;
}
