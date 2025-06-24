'use client';
import { useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { StatsModal } from '@/components/modal/stats-modal';
import {
  useAggregateStats,
  useHealth,
  usePoolInfo,
  useSystemStats
} from '@/hooks/use-proxy-state';
import {
  IconTrendingUp,
  IconChartBar,
  IconActivity,
  IconServer,
  IconCpu,
  IconNetwork,
  IconDeviceDesktop
} from '@tabler/icons-react';
import React from 'react';
import { formatHashrate } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

export default function OverViewLayout({
  pie_stats,
  area_stats,
  mempool_transactions
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  area_stats: React.ReactNode;
  mempool_transactions: React.ReactNode;
}) {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const {
    data: health,
    error: healthError,
    loading: healthLoading
  } = useHealth();

  const {
    data: poolInfo,
    error: poolError,
    loading: poolLoading
  } = usePoolInfo();

  const {
    data: aggregateStats,
    error: aggregateError,
    loading: aggregateLoading
  } = useAggregateStats();

  const {
    data: systemStats,
    error: systemError,
    loading: systemLoading
  } = useSystemStats();

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between space-y-2'>
          <div className='space-y-1'>
            <h2 className='text-2xl font-bold tracking-tight'>
              Hi, Welcome back 👋
            </h2>
          </div>
          <div className='flex items-center gap-3'>
            <Button
              onClick={() => setIsStatsModalOpen(true)}
              variant='outline'
              className='hover:bg-primary/5 flex items-center gap-2 transition-colors'
            >
              <IconChartBar className='h-4 w-4' />
              Detailed Stats
            </Button>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant={
                    healthLoading
                      ? 'secondary'
                      : healthError
                        ? 'destructive'
                        : 'default'
                  }
                  className='flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium shadow-sm transition-all hover:shadow-md'
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      healthLoading
                        ? 'animate-pulse bg-gray-400'
                        : healthError
                          ? 'animate-pulse bg-red-500'
                          : 'bg-green-500'
                    }`}
                  />
                  {healthLoading
                    ? 'Connecting...'
                    : healthError
                      ? `${healthError}`
                      : health?.status}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Last Updated:
                {health?.timestamp
                  ? new Date(health.timestamp).toLocaleString()
                  : 'Unknown'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription className='flex items-center gap-2'>
                <IconNetwork className='h-4 w-4' />
                Pool Address
              </CardDescription>
              <CardTitle className='text-xl font-semibold tabular-nums @[250px]/card:text-2xl'>
                {poolLoading ? (
                  <div className='animate-pulse'>
                    <div className='h-5 w-3/4 rounded bg-gray-200'></div>
                  </div>
                ) : poolError ? (
                  `Error: ${poolError}`
                ) : poolInfo?.address ? (
                  <span>{poolInfo.address}</span>
                ) : (
                  'N/A'
                )}
              </CardTitle>
            </CardHeader>
            <CardFooter className='flex-row items-start gap-1.5 text-sm'>
              <div className='text-muted-foreground'>Latency:</div>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {poolLoading
                  ? 'Loading...'
                  : poolError
                    ? 'N/A'
                    : poolInfo?.latency || 'N/A'}{' '}
                ms
              </div>
            </CardFooter>
          </Card>

          <Card className='@container/card'>
            <CardHeader>
              <CardDescription className='flex items-center gap-2'>
                <IconDeviceDesktop className='h-4 w-4' />
                Connected Devices
              </CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {aggregateLoading ? (
                  <div className='animate-pulse'>
                    <div className='h-8 w-16 rounded bg-gray-200'></div>
                  </div>
                ) : aggregateError ? (
                  'N/A'
                ) : (
                  aggregateStats?.total_connected_device || 0
                )}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <IconActivity className='mr-1 h-3 w-3' />
                  Active
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='flex items-center gap-2 font-medium'>
                Mining devices online <IconTrendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>Total active miners</div>
            </CardFooter>
          </Card>

          <Card className='@container/card'>
            <CardHeader>
              <CardDescription className='flex items-center gap-2'>
                <IconServer className='h-4 w-4' />
                Total Hashrate
              </CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {aggregateLoading ? (
                  <div className='animate-pulse'>
                    <div className='h-7 w-20 rounded bg-gray-200'></div>
                  </div>
                ) : aggregateError ? (
                  'N/A'
                ) : aggregateStats?.total_hashrate ? (
                  formatHashrate(aggregateStats.total_hashrate, 2)
                ) : (
                  '0 TH/s'
                )}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <IconTrendingUp className='mr-1 h-3 w-3' />
                  Mining
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='relative flex-col items-start gap-1.5 text-sm'>
              <div className='flex items-center gap-2 font-medium'>
                Combined mining power <IconTrendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                Aggregate hash performance
              </div>
            </CardFooter>
          </Card>

          <Card className='@container/card'>
            <CardHeader>
              <CardDescription className='flex items-center gap-2'>
                <IconCpu className='h-4 w-4' />
                CPU Usage
              </CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {systemLoading ? (
                  <div className='animate-pulse'>
                    <div className='h-7 w-16 rounded bg-gray-200'></div>
                  </div>
                ) : systemError ? (
                  'N/A'
                ) : systemStats?.cpu_usage ? (
                  `${systemStats.cpu_usage.toFixed(1)}%`
                ) : (
                  '0%'
                )}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <IconActivity className='mr-1 h-3 w-3' />
                  {systemStats?.cpu_usage && systemStats.cpu_usage > 80
                    ? 'High'
                    : systemStats?.cpu_usage && systemStats.cpu_usage > 60
                      ? 'Medium'
                      : 'Normal'}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='relative flex-col items-start gap-1.5 text-sm'>
              <div className='flex items-center gap-2 font-medium'>
                System performance <IconTrendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                Memory:{' '}
                {systemLoading
                  ? 'Loading...'
                  : systemError
                    ? 'N/A'
                    : systemStats?.memory_usage || 'N/A'}
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-7'>{mempool_transactions}</div>
          <div className='col-span-4'>{area_stats}</div>
          <div className='col-span-4 md:col-span-3'>{pie_stats}</div>
        </div>

        <StatsModal
          isOpen={isStatsModalOpen}
          onClose={() => setIsStatsModalOpen(false)}
        />
      </div>
    </PageContainer>
  );
}
