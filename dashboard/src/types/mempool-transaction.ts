interface Fee {
  base: number;
  modified: number;
  ancestor: number;
  descendant: number;
}

interface Txid {
  txid: string;
  wtxid: string;
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
  wtxid: Txid;
  fees: Fee;
  feeRate: number;
  depends: Txid[];
  spent_by: Txid[];
  bip125_replaceable: boolean;
  unbroadcast: boolean | null;
}
