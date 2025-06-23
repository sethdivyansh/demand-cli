'use client';

import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useAggregateStats,
  useHealth,
  useMinerStats,
  usePoolInfo,
  useSystemStats
} from '@/hooks/use-proxy-state';
import {
  IconCpu,
  IconDeviceDesktop,
  IconNetwork,
  IconChartBar,
  IconActivity,
  IconClock,
  IconTrendingUp,
  IconTrendingDown
} from '@tabler/icons-react';
import { formatHashrate } from '@/lib/utils';
import { Progress } from '../ui/progress';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose }) => {
  const { data: health, loading: healthLoading } = useHealth();
  const { data: poolInfo, loading: poolLoading } = usePoolInfo();
  const { data: minerStats, loading: minerLoading } = useMinerStats();
  const { data: aggregateStats, loading: aggregateLoading } =
    useAggregateStats();
  const { data: systemStats, loading: systemLoading } = useSystemStats();

  return (
    <Modal
      title='Mining Pool Statistics'
      description='Detailed view of mining pool performance and system metrics'
      isOpen={isOpen}
      onClose={onClose}
      size='lg'
    >
      <div className='w-full'>
        <Tabs defaultValue='overview' className='w-full'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='miners'>Miners</TabsTrigger>
            <TabsTrigger value='system'>System</TabsTrigger>
            <TabsTrigger value='pool'>Pool Info</TabsTrigger>
          </TabsList>

          <TabsContent value='overview' className='space-y-4'>
            <ScrollArea className='h-[600px] w-full'>
              <div className='space-y-4 pr-4'>
                {/* Health Status */}
                <Card>
                  <CardHeader className='flex flex-row items-center space-y-0 pb-2'>
                    <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                      <IconActivity className='h-4 w-4' />
                      Health Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='flex items-center gap-2'>
                      <Badge
                        variant={healthLoading ? 'secondary' : 'default'}
                        className='flex items-center gap-2'
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            healthLoading
                              ? 'animate-pulse bg-gray-400'
                              : 'bg-green-500'
                          }`}
                        />
                        {healthLoading
                          ? 'Loading...'
                          : health?.status || 'Unknown'}
                      </Badge>
                      {health?.timestamp && (
                        <span className='text-muted-foreground text-sm'>
                          Last updated:{' '}
                          {new Date(health.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Aggregate Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <IconChartBar className='h-4 w-4' />
                      Aggregate Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {aggregateLoading ? (
                      <div className='text-muted-foreground text-center'>
                        Loading...
                      </div>
                    ) : aggregateStats ? (
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <div className='text-sm font-medium'>
                            Connected Devices
                          </div>
                          <div className='text-2xl font-bold'>
                            {aggregateStats.total_connected_device}
                          </div>
                        </div>
                        <div className='space-y-2'>
                          <div className='text-sm font-medium'>
                            Total Hashrate
                          </div>
                          <div className='text-2xl font-bold'>
                            {formatHashrate(aggregateStats.total_hashrate)}
                          </div>
                        </div>
                        <div className='space-y-2'>
                          <div className='text-sm font-medium'>
                            Accepted Shares
                          </div>
                          <div className='text-xl font-semibold text-green-600'>
                            {aggregateStats.total_accepted_shares.toLocaleString()}
                          </div>
                        </div>
                        <div className='space-y-2'>
                          <div className='text-sm font-medium'>
                            Rejected Shares
                          </div>
                          <div className='text-xl font-semibold text-red-600'>
                            {aggregateStats.total_rejected_shares.toLocaleString()}
                          </div>
                        </div>
                        <div className='col-span-2 space-y-2'>
                          <div className='text-sm font-medium'>
                            Current Difficulty
                          </div>
                          <div className='text-xl font-semibold'>
                            {aggregateStats.aggregate_diff.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className='text-muted-foreground text-center'>
                        No data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='miners' className='space-y-4'>
            <ScrollArea className='h-[600px] w-full'>
              <div className='space-y-4 pr-4'>
                {minerLoading ? (
                  <div className='text-muted-foreground text-center'>
                    Loading miners...
                  </div>
                ) : minerStats ? (
                  Object.entries(minerStats).map(([id, miner]) => (
                    <Card key={id}>
                      <CardHeader className='pb-3'>
                        <CardTitle className='flex items-center gap-2 text-base'>
                          <IconDeviceDesktop className='h-4 w-4' />
                          {miner.device_name}
                        </CardTitle>
                        <CardDescription>Miner ID: {id}</CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-3'>
                        <div className='grid grid-cols-2 gap-4'>
                          <div className='space-y-1'>
                            <div className='text-sm font-medium'>Hashrate</div>
                            <div className='text-lg font-semibold'>
                              {formatHashrate(miner.hashrate)}
                            </div>
                          </div>
                          <div className='space-y-1'>
                            <div className='text-sm font-medium'>
                              Difficulty
                            </div>
                            <div className='text-lg font-semibold'>
                              {miner.current_difficulty.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <Separator />
                        <div className='flex justify-between'>
                          <div className='flex items-center gap-2'>
                            <IconTrendingUp className='h-4 w-4 text-green-600' />
                            <span className='text-sm'>
                              Accepted: {miner.accepted_shares}
                            </span>
                          </div>
                          <div className='flex items-center gap-2'>
                            <IconTrendingDown className='h-4 w-4 text-red-600' />
                            <span className='text-sm'>
                              Rejected: {miner.rejected_shares}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className='text-muted-foreground text-center'>
                    No miner data available
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='system' className='space-y-4'>
            <ScrollArea className='h-[600px] w-full'>
              <div className='space-y-4 pr-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <IconCpu className='h-4 w-4' />
                      System Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {systemLoading ? (
                      <div className='text-muted-foreground text-center'>
                        Loading system stats...
                      </div>
                    ) : systemStats ? (
                      <div className='space-y-4'>
                        <div className='flex items-center justify-between'>
                          <div className='space-y-1'>
                            <div className='text-sm font-medium'>CPU Usage</div>
                            <div className='text-2xl font-bold'>
                              {systemStats.cpu_usage.toFixed(1)}%
                            </div>
                          </div>
                          <Badge
                            variant={
                              systemStats.cpu_usage > 80
                                ? 'destructive'
                                : systemStats.cpu_usage > 60
                                  ? 'secondary'
                                  : 'default'
                            }
                          >
                            {systemStats.cpu_usage > 80
                              ? 'High Load'
                              : systemStats.cpu_usage > 60
                                ? 'Medium Load'
                                : 'Normal'}
                          </Badge>
                        </div>
                        <Progress value={systemStats.cpu_usage} />
                        <Separator />
                        <div className='space-y-1'>
                          <div className='text-sm font-medium'>
                            Memory Usage
                          </div>
                          <div className='text-lg font-semibold'>
                            {systemStats.memory_usage}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className='text-muted-foreground text-center'>
                        No system data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='pool' className='space-y-4'>
            <ScrollArea className='h-[600px] w-full'>
              <div className='space-y-4 pr-4'>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <IconNetwork className='h-4 w-4' />
                      Pool Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {poolLoading ? (
                      <div className='text-muted-foreground text-center'>
                        Loading pool info...
                      </div>
                    ) : poolInfo ? (
                      <div className='space-y-4'>
                        <div className='space-y-2'>
                          <div className='text-sm font-medium'>
                            Pool Address
                          </div>
                          <div className='bg-muted rounded p-2 font-mono text-sm'>
                            {poolInfo.address}
                          </div>
                        </div>
                        <Separator />
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            <IconClock className='h-4 w-4' />
                            <div className='flex flex-row gap-2'>
                              <div className='text-md font-medium'>Latency</div>
                              <div className='text-md font-semibold'>
                                {poolInfo.latency} ms
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={
                              poolInfo.latency > 100
                                ? 'destructive'
                                : poolInfo.latency > 50
                                  ? 'secondary'
                                  : 'default'
                            }
                          >
                            {poolInfo.latency > 100
                              ? 'High'
                              : poolInfo.latency > 50
                                ? 'Medium'
                                : 'Low'}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className='text-muted-foreground text-center'>
                        No pool data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </Modal>
  );
};
