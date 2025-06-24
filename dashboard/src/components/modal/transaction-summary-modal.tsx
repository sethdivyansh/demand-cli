import React from 'react';
import { Modal } from '@/components/ui/modal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { MempoolTransaction } from '@/types/mempool-transaction';

interface TransactionSummaryModalProps {
  isOpen: boolean;
  selectedData: MempoolTransaction[];
  handleModal: (open: boolean) => void;
}

interface TransactionSummary {
  totalTransactions: number;
  totalVirtualSize: number;
  totalWeight: number;
  totalFees: number;
  averageFeeRate: number;
  maxAncestorCount: number;
  maxDescendantCount: number;
}

const MAX_BLOCK_WEIGHT = 4_000_000; // Bitcoin block weight limit
const SATOSHI_TO_BTC = 100_000_000; // 1 BTC = 100,000,000 satoshis

export function TransactionSummaryModal({
  isOpen,
  selectedData,
  handleModal
}: TransactionSummaryModalProps) {
  const summary = React.useMemo<TransactionSummary>(() => {
    if (selectedData.length === 0) {
      return {
        totalTransactions: 0,
        totalVirtualSize: 0,
        totalWeight: 0,
        totalFees: 0,
        averageFeeRate: 0,
        maxAncestorCount: 0,
        maxDescendantCount: 0
      };
    }

    const totalTransactions = selectedData.length;
    const totalVirtualSize = selectedData.reduce(
      (sum, tx) => sum + tx.vsize,
      0
    );
    const totalWeight = selectedData.reduce(
      (sum, tx) => sum + (tx.weight || tx.vsize * 4),
      0
    );
    const totalFees = selectedData.reduce((sum, tx) => sum + tx.fees.base, 0);
    const averageFeeRate =
      totalVirtualSize > 0 ? totalFees / totalVirtualSize : 0;
    const maxAncestorCount = Math.max(
      ...selectedData.map((tx) => tx.ancestor_count)
    );
    const maxDescendantCount = Math.max(
      ...selectedData.map((tx) => tx.descendant_count)
    );

    return {
      totalTransactions,
      totalVirtualSize,
      totalWeight,
      totalFees,
      averageFeeRate,
      maxAncestorCount,
      maxDescendantCount
    };
  }, [selectedData]);

  const formatBTC = (satoshis: number): string => {
    return (satoshis / SATOSHI_TO_BTC).toFixed(8);
  };

  const weightPercentage = (summary.totalWeight / MAX_BLOCK_WEIGHT) * 100;

  return (
    <Modal
      title='Transaction Summary'
      description='Aggregate statistics for selected transactions'
      isOpen={isOpen}
      onClose={() => handleModal(false)}
      size='4xl'
    >
      <div className='space-y-6'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {/* Total Transactions */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {summary.totalTransactions}
                <span className='text-muted-foreground ml-1 text-sm font-normal'>
                  txs
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Total Virtual Size */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Virtual Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {summary.totalVirtualSize}
                <span className='text-muted-foreground ml-1 text-sm font-normal'>
                  vbytes
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Total Weight */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Weight
              </CardTitle>
              <CardDescription>
                {weightPercentage.toFixed(2)}% of max block weight
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                <div className='text-2xl font-bold'>
                  {summary.totalWeight}
                  <span className='text-muted-foreground ml-1 text-sm font-normal'>
                    / {MAX_BLOCK_WEIGHT}
                  </span>
                </div>
                <Progress
                  value={Math.min(weightPercentage, 100)}
                  className='h-2'
                />
              </div>
            </CardContent>
          </Card>

          {/* Total Fees */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Total Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-1'>
                <div className='text-2xl font-bold'>
                  {formatBTC(summary.totalFees)}
                  <span className='text-muted-foreground ml-1 text-sm font-normal'>
                    BTC
                  </span>
                </div>
                <div className='text-muted-foreground text-sm'>
                  {summary.totalFees} sats
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Fee Rate */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>
                Average Fee Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {summary.averageFeeRate.toFixed(1)}
                <span className='text-muted-foreground ml-1 text-sm font-normal'>
                  sat/vB
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Chain Metrics */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>
                Chain Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground text-sm'>
                    Max Ancestors:
                  </span>
                  <Badge variant='secondary'>{summary.maxAncestorCount}</Badge>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground text-sm'>
                    Max Descendants:
                  </span>
                  <Badge variant='secondary'>
                    {summary.maxDescendantCount}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Details Section */}
        {summary.totalTransactions > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Additional Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 gap-4 text-sm md:grid-cols-2'>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      Average tx size:
                    </span>
                    <span>
                      {(
                        summary.totalVirtualSize / summary.totalTransactions
                      ).toFixed(0)}{' '}
                      vbytes
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      Average tx weight:
                    </span>
                    <span>
                      {(
                        summary.totalWeight / summary.totalTransactions
                      ).toFixed(0)}{' '}
                      weight units
                    </span>
                  </div>
                </div>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      Average fee per tx:
                    </span>
                    <span>
                      {(summary.totalFees / summary.totalTransactions).toFixed(
                        0
                      )}{' '}
                      sats
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      Block space usage:
                    </span>
                    <span>{weightPercentage.toFixed(4)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Modal>
  );
}
