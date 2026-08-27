const GAZETTE_BASE = "https://www.thegazette.co.uk";
const UA = "NexusOrigination/1.0 (Strata Finance; gazette ingest)";

export type GazetteFeedEntry = {
  id?: string;
  title?: string;
  published?: string;
  content?: string;
  "f:notice-code"?: string | number;
  category?: { "@term"?: string };
};

export type GazetteFeed = {
  entry?: GazetteFeedEntry | GazetteFeedEntry[];
  "f:total"?: string | number;
};

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function gazetteGet(url: string, timeoutMs = 12000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Gazette ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGazetteNotices(params: {
  service?: "insolvency" | "all-notices";
  noticeType?: string;
  text?: string;
  startPublishDate?: string;
  pageSize?: number;
  page?: number;
}): Promise<{ entries: GazetteFeedEntry[]; total: number }> {
  const query = new URLSearchParams();
  if (params.noticeType) query.set("noticetype", params.noticeType);
  if (params.text) query.set("text", params.text);
  if (params.startPublishDate) query.set("start-publish-date", params.startPublishDate);
  query.set("results-page-size", String(params.pageSize ?? 20));
  query.set("results-page", String(params.page ?? 1));
  query.set("sort-by", "latest-date");
  const service = params.service || "insolvency";
  const data = (await gazetteGet(`${GAZETTE_BASE}/${service}/notice/data.json?${query.toString()}`)) as GazetteFeed;
  return {
    entries: asArray(data.entry),
    total: Number(data["f:total"] || 0),
  };
}

export function noticeIdFromEntry(entry: GazetteFeedEntry): string | undefined {
  const href = entry.id || "";
  const match = href.match(/notice\/(\d+)/);
  return match?.[1];
}

export async function getGazetteNoticeLinkedData(noticeId: string): Promise<any> {
  return gazetteGet(`${GAZETTE_BASE}/notice/${encodeURIComponent(noticeId)}/data.json?view=linked-data`);
}


