import { Wallet } from 'lucide-react';
import { FinanceEmbed } from './FinanceEmbed';

export function Component() {
  return <FinanceEmbed serviceName="firefly" displayName="Firefly III" port={8083} icon={Wallet} color="#22c55e" />;
}
