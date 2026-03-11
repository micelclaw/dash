import { Receipt } from 'lucide-react';
import { FinanceEmbed } from './FinanceEmbed';

export function Component() {
  return <FinanceEmbed serviceName="solidinvoice" displayName="SolidInvoice" port={8084} icon={Receipt} color="#22c55e" />;
}
