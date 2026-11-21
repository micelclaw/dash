import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SlackMeetingsPanel } from './SlackMeetingsPanel';

export function SlackChannelTabs({ supported, messages }: { supported: boolean; messages: ReactNode }) {
  if (!supported) return messages;
  return <Tabs defaultValue="messages" className="rounded-lg border border-border p-2">
    <TabsList aria-label="Slack"><TabsTrigger value="messages">Mensajes de Slack</TabsTrigger><TabsTrigger value="meetings">Reuniones</TabsTrigger></TabsList>
    <TabsContent value="messages">{messages}</TabsContent>
    <TabsContent value="meetings"><SlackMeetingsPanel /></TabsContent>
  </Tabs>;
}
