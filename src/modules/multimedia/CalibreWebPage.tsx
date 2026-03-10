import { Library } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="calibreweb" displayName="Calibre Web" description="eBook Library" port={8083} icon={Library} color="#8b5cf6" />;
}
