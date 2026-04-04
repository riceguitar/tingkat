export interface DataForSEOKeywordResult {
  keyword: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  intent: string;
  competition: number;
  trend: number[];
}

export interface DataForSEOSerpResult {
  keyword: string;
  position: number | null;
  url: string | null;
  title: string | null;
}

export interface DataForSEOResponse<T> {
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    result: T[] | null;
  }>;
}
