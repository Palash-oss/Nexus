export type SearchResultItem = {
  id: string;
  source: "GMAIL" | "DRIVE" | "WEB";
  title: string;
  snippet: string;
  author: string | null;
  date: string | null;
  url: string;
  score: number;
  aiSummary?: string;
};

export type SearchApiResponse = {
  query: string;
  count: number;
  tookMs: number;
  results: SearchResultItem[];
};
