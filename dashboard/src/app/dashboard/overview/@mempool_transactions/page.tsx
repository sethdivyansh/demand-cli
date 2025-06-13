import { delay } from '@/constants/mock-api';
import { Transactions } from '@/features/overview/components/transactions';

export default async function MempoolTx() {
  await delay(1000);
  return <Transactions />;
}
