import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app";
import { syncWallet, type SyncResult } from "@/lib/sync-engine";
import { loadSyncCache } from "@/lib/sync-cache";
import {
  fetchPrice,
  fetchMarketChart,
  fetchFearGreed,
  fetchAth,
  mempoolApi,
  type RecommendedFees,
  type MempoolInfo,
  type PriceData,
  type MarketChartPoint,
  type AthData,
} from "@/lib/mempool";

export function useSync() {
  const wallet = useAppStore((s) => s.wallet);
  const cached = wallet ? loadSyncCache(wallet.normalizedXpub, wallet.scriptType) : null;
  return useQuery<SyncResult>({
    queryKey: ["sync", wallet?.normalizedXpub, wallet?.scriptType],
    queryFn: () => syncWallet(wallet!),
    enabled: !!wallet,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    initialData: cached?.result,
    initialDataUpdatedAt: cached?.savedAt,
  });
}

export function usePrice() {
  return useQuery<PriceData>({
    queryKey: ["price"],
    queryFn: fetchPrice,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMarketChart(days: number | "max", vsCurrency: string = "usd") {
  return useQuery<MarketChartPoint[]>({
    queryKey: ["chart", days, vsCurrency.toLowerCase()],
    queryFn: () => fetchMarketChart(days, vsCurrency),
    staleTime: 5 * 60_000,
  });
}

export function useFearGreed() {
  return useQuery({
    queryKey: ["fng"],
    queryFn: fetchFearGreed,
    staleTime: 30 * 60_000,
  });
}

export function useFees() {
  return useQuery<RecommendedFees>({
    queryKey: ["fees"],
    queryFn: () => mempoolApi.recommendedFees(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useMempoolStats() {
  return useQuery<MempoolInfo>({
    queryKey: ["mempool"],
    queryFn: () => mempoolApi.mempoolInfo(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useTipBlock() {
  return useQuery({
    queryKey: ["tip"],
    queryFn: () => mempoolApi.tipBlock(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
