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
