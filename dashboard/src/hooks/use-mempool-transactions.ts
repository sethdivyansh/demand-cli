'use client';

import { parseMempoolTransaction } from '@/lib/utils';
import { MempoolTransaction } from '@/types/mempool-transaction';
import React from 'react';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { toast } from 'sonner';

export function useMempoolTransactions() {
  const [transactions, setTransactions] = React.useState<MempoolTransaction[]>(
    []
  );
  const [pausedTx, setPausedTx] = React.useState<MempoolTransaction[]>([]);
  const [isFetching, setIsFetching] = React.useState(true);
  const fetchingRef = React.useRef(isFetching);
  const wsTxsNewRef = React.useRef<ReconnectingWebSocket | null>(null);
  const wsNewBlockRef = React.useRef<ReconnectingWebSocket | null>(null);

  React.useEffect(() => {
    const apiUrl = 'http://localhost:3001/api/mempool';
    axios
      .get<MempoolTransaction[]>(apiUrl)
      .then((response) => {
        const data = response.data;
        setTransactions(
          data.map((tx) => ({
            ...parseMempoolTransaction(tx),
            feeRate: (tx.fees.base * 1e8) / tx.vsize
          }))
        );
      })
      .catch(() => {
        // console.error('Failed to fetch mempool transactions');
      });
  }, []);

  React.useEffect(() => {
    fetchingRef.current = isFetching;
  }, [isFetching]);

  React.useEffect(() => {
    const ws = new ReconnectingWebSocket('ws://localhost:3001/ws/txs/new');
    wsTxsNewRef.current = ws;
    ws.onmessage = (e) => {
      const tx = parseMempoolTransaction(JSON.parse(e.data));
      if (fetchingRef.current) {
        setTransactions((prev) => [
          tx,
          ...prev.filter((t) => t.txid !== tx.txid)
        ]);
      } else {
        setPausedTx((prev) => [tx, ...prev.filter((t) => t.txid !== tx.txid)]);
      }
    };
    return () => {
      ws.close();
      wsTxsNewRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (isFetching && pausedTx.length > 0) {
      setTransactions((prev) => {
        const prevHashes = new Set(prev.map((tx) => tx.txid));
        const filteredPaused = pausedTx.filter(
          (tx) => !prevHashes.has(tx.txid)
        );
        return [...prev, ...filteredPaused];
      });
      setPausedTx([]);
    }
  }, [isFetching, pausedTx]);

  React.useEffect(() => {
    const ws = new ReconnectingWebSocket(
      'ws://localhost:3001/ws/blocks/confirmed/txids'
    );
    wsNewBlockRef.current = ws;
    ws.onmessage = (e) => {
      const { block_hash, txids } = JSON.parse(e.data);
      const shortHash = block_hash.slice(0, 8) + '...';

      toast.info(`New Block ${shortHash} Mined`, {
        description: `Removing ${txids.length - 1} confirmed transactions`, // Subtracting 1 because the block itself is included in the txids list but is not a transaction
        duration: 4000,
        action: {
          label: 'View Block',
          onClick: () =>
            window.open(`https://mempool.space/block/${block_hash}`, '_blank')
        }
      });

      const toRemove = new Set(txids);
      setTransactions((tx) => tx.filter((t) => !toRemove.has(t.txid)));
      setPausedTx((p) => p.filter((t) => !toRemove.has(t.txid)));
    };
    return () => {
      ws.close();
      wsNewBlockRef.current = null;
    };
  }, []);

  return { transactions, isFetching, toggle: () => setIsFetching((f) => !f) };
}
