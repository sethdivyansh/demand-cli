import { Card } from '@/components/ui/card';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function Loading() {
  return (
    <Card className='h-full px-2'>
      <DataTableSkeleton columnCount={5} rowCount={8} />
    </Card>
  );
}
