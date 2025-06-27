interface Fee {
  base: number;
  modified: number;
  ancestor: number;
  descendant: number;
}

export interface MempoolTransaction {
  txid: string;
  vsize: number;
  weight: number | null;
  time: number;
  height: number;
  descendant_count: number;
  descendant_size: number;
  ancestor_count: number;
  ancestor_size: number;
  wtxid: String;
  fees: Fee;
  feeRate: number;
  depends: String[];
  spent_by: String[];
  bip125_replaceable: boolean;
  unbroadcast: boolean;
}

// Types to match the backend sequence events
interface SequenceEvent {
  event: 'A' | 'R' | 'C' | 'D';
}

export interface MempoolAddEvent extends SequenceEvent {
  event: 'A';
  sequence: number;
  transaction: MempoolTransaction;
}

export interface MempoolRemoveEvent extends SequenceEvent {
  event: 'R';
  sequence: number;
  txid: string;
}

export interface BlockConnectEvent extends SequenceEvent {
  event: 'C';
  block: {
    block_hash: string;
    txids: string[];
  };
}

export interface BlockDisconnectEvent extends SequenceEvent {
  event: 'D';
  block_hash: string;
  transactions: MempoolTransaction[];
}

export type SequenceEventType =
  | MempoolAddEvent
  | MempoolRemoveEvent
  | BlockConnectEvent
  | BlockDisconnectEvent;
