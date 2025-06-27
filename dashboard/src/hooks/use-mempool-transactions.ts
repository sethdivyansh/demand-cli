'use client';

import {
  BlockConnectEvent,
  BlockDisconnectEvent,
  MempoolAddEvent,
  MempoolRemoveEvent,
  MempoolTransaction,
  SequenceEventType
} from '@/types/mempool-transaction';
import React from 'react';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { toast } from 'sonner';
import { parseMempoolTransaction } from '@/lib/parsers';

/**
 * React hook to manage and subscribe to real-time Bitcoin mempool transactions.
 *
 * This hook fetches the initial mempool transaction list from a REST API and
 * listens for live updates via a WebSocket stream. It handles transaction additions,
 * removals, block connections, and block disconnections, updating the local state
 * accordingly. The hook also supports pausing and resuming live updates, buffering
 * incoming transactions while paused and merging them when resumed.
 *
 * Features:
 * - Fetches the current mempool transactions on mount.
 * - Subscribes to WebSocket events for mempool and block updates:
 *   - Adds new transactions as they appear.
 *   - Removes transactions when they are confirmed or dropped.
 *   - Handles block connections by removing confirmed transactions.
 *   - Handles block disconnections by re-adding orphaned transactions.
 * - Displays toast notifications for mempool and block events.
 * - Allows toggling of live updates, buffering transactions while paused.
 *
 * @returns An object containing:
 *   - `transactions`: The current list of mempool transactions.
 *   - `isFetching`: Boolean indicating if live updates are active.
 *   - `toggle`: Function to pause or resume live updates.
 */

export function useMempoolTransactions() {
  const [transactions, setTransactions] = React.useState<MempoolTransaction[]>(
    []
  );
  // This will hold transactions that were added while fetching is paused
  const [pausedTx, setPausedTx] = React.useState<MempoolTransaction[]>([]);
  const [isFetching, setIsFetching] = React.useState(true);
  const fetchingRef = React.useRef(isFetching);
  const wsStreamRef = React.useRef<ReconnectingWebSocket | null>(null);

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
    const ws = new ReconnectingWebSocket(
      'ws://localhost:3001/ws/bitcoin/stream'
    );
    wsStreamRef.current = ws;

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data) as SequenceEventType;

      switch (event.event) {
        case 'A': // Tx Add
          const addEvent = event as MempoolAddEvent;
          const tx = {
            ...parseMempoolTransaction(addEvent.transaction),
            feeRate:
              (addEvent.transaction.fees.base * 1e8) /
              addEvent.transaction.vsize
          };

          if (fetchingRef.current) {
            setTransactions((prev) => [
              tx,
              ...prev.filter((t) => t.txid !== tx.txid)
            ]);
          } else {
            setPausedTx((prev) => [
              tx,
              ...prev.filter((t) => t.txid !== tx.txid)
            ]);
          }
          break;

        case 'R': // Tx Remove
          const removeEvent = event as MempoolRemoveEvent;
          setTransactions((prev) =>
            prev.filter((t) => t.txid !== removeEvent.txid)
          );
          setPausedTx((prev) =>
            prev.filter((t) => t.txid !== removeEvent.txid)
          );
          toast.success(`Transaction Removed`, {
            description: `${removeEvent.txid.slice(0, 12)}... was removed from mempool`,
            action: {
              label: 'View TX',
              onClick: () =>
                window.open(
                  `https://mempool.space/tx/${removeEvent.txid}`,
                  '_blank'
                )
            }
          });
          break;

        case 'C': // Block Connect
          const connectEvent = event as BlockConnectEvent;
          const shortHash = connectEvent.block.block_hash.slice(0, 8) + '...';
          const confirmedCount = connectEvent.block.txids.length - 1; // Subtract coinbase tx

          toast.success(`⛏️ Block Mined`, {
            description: `Block ${shortHash} confirmed ${confirmedCount} transactions`,
            action: {
              label: 'View Block',
              onClick: () =>
                window.open(
                  `https://mempool.space/block/${connectEvent.block.block_hash}`,
                  '_blank'
                )
            }
          });

          const toRemove = new Set(connectEvent.block.txids);
          setTransactions((prev) => prev.filter((t) => !toRemove.has(t.txid)));
          setPausedTx((prev) => prev.filter((t) => !toRemove.has(t.txid)));
          break;

        case 'D': // Block Disconnect
          const disconnectEvent = event as BlockDisconnectEvent;
          const disconnectShortHash =
            disconnectEvent.block_hash.slice(0, 8) + '...';

          toast.warning(`🔄 Chain Reorganization`, {
            description: `Block ${disconnectShortHash} disconnected, ${disconnectEvent.transactions.length} txs back to mempool`,
            action: {
              label: 'View Block',
              onClick: () =>
                window.open(
                  `https://mempool.space/block/${disconnectEvent.block_hash}`,
                  '_blank'
                )
            }
          });

          const orphanedBlockTxs = disconnectEvent.transactions.map((tx) => ({
            ...parseMempoolTransaction(tx),
            feeRate: (tx.fees.base * 1e8) / tx.vsize
          }));

          const addTransactions = (prev: MempoolTransaction[]) => {
            const prevHashes = new Set(prev.map((t) => t.txid));
            const newTxs = orphanedBlockTxs.filter(
              (tx) => !prevHashes.has(tx.txid)
            );
            return [...prev, ...newTxs];
          };

          if (fetchingRef.current) {
            setTransactions(addTransactions);
          } else {
            setPausedTx(addTransactions);
          }
          break;
      }
    };

    return () => {
      ws.close();
      wsStreamRef.current = null;
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

  return { transactions, isFetching, toggle: () => setIsFetching((f) => !f) };
}
