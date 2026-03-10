import { BookOpen } from 'lucide-react';
import { MultimediaEmbed } from './MultimediaEmbed';

export function Component() {
  return <MultimediaEmbed serviceName="readarr" displayName="Readarr" description="Book Automation" port={8787} icon={BookOpen} color="#8b5cf6" />;
}
