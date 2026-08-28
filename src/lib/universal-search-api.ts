import { useQuery } from "@tanstack/react-query";
import * as fn from "@/lib/universal-search.functions";
import type { SearchResult } from "@/lib/universal-search.functions";

export type {
  SearchResult,
  SearchResultType,
} from "@/lib/universal-search.functions";

export interface UniversalSearchResponse {
  results: SearchResult[];
  looksLikeQuestion: boolean;
}

export function useUniversalSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["universal-search", trimmed],
    enabled: trimmed.length > 0,
    queryFn: () =>
      fn.universalSearch({
        data: { query: trimmed },
      }) as Promise<UniversalSearchResponse>,
  });
}
