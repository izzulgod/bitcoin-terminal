// Lightweight client for mempool.space REST API.
// Docs: https://mempool.space/docs/api/rest

const BASE = "https://mempool.space/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`mempool ${path} -> ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export interface AddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
}

export interface TxVin {
  txid: string;
  vout: number;
  prevout: { scriptpubkey_address?: string; value: number } | null;
}
export interface TxVout {
  scriptpubkey_address?: string;
  value: number;
}
export interface Tx {
  txid: string;
  version: number;
  size: number;
  weight: number;
  fee: number;
  vin: TxVin[];
  vout: TxVout[];
  status: { confirmed: boolean; block_height?: number; block_time?: number };
}

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface MempoolInfo {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: [number, number][];
}

export interface BlockTip {
  id: string;
  height: number;
  timestamp: number;
}

export const mempoolApi = {
  address: (addr: string) => get<AddressInfo>(`/address/${addr}`),
  addressUtxo: (addr: string) => get<UTXO[]>(`/address/${addr}/utxo`),
  addressTxs: (addr: string) => get<Tx[]>(`/address/${addr}/txs`),
  recommendedFees: () => get<RecommendedFees>("/v1/fees/recommended"),
  mempoolInfo: () => get<MempoolInfo>("/mempool"),
  tipHeight: () => get<number>("/blocks/tip/height"),
  tipBlock: () => get<BlockTip[]>("/v1/blocks"),
};

export interface PriceData {
  usd: number;
  idr: number;
  usd_24h_change: number;
}

// CoinGecko public endpoint — no key needed
export async function fetchPrice(): Promise<PriceData> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,idr&include_24hr_change=true"
  );
  if (!res.ok) throw new Error("price fetch failed");
  const data = (await res.json()) as {
    bitcoin: { usd: number; idr: number; usd_24h_change: number };
  };
  return {
    usd: data.bitcoin.usd,
    idr: data.bitcoin.idr,
    usd_24h_change: data.bitcoin.usd_24h_change,
  };
}

export interface MarketChartPoint {
  t: number;
  v: number;
}
export async function fetchMarketChart(days: number): Promise<MarketChartPoint[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`
  );
  if (!res.ok) throw new Error("chart fetch failed");
  const data = (await res.json()) as { prices: [number, number][] };
  return data.prices.map(([t, v]) => ({ t, v }));
}

export async function fetchFearGreed(): Promise<{ value: number; classification: string }> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1");
  if (!res.ok) throw new Error("fng fetch failed");
  const data = (await res.json()) as {
    data: { value: string; value_classification: string }[];
  };
  return {
    value: parseInt(data.data[0].value, 10),
    classification: data.data[0].value_classification,
  };
}
