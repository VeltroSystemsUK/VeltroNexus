import { isStrataSiteUrl, londonDateKey } from "./smeConvert";

export type SiteTrafficDay = {
  day: string;
  clicks: number;
  uniqueClickThroughs: number;
  dwells: number;
};

export type MailForSiteTraffic = {
  id?: string;
  clicks?: Array<{ at?: string; url?: string }>;
  dwells?: Array<{ at?: string }>;
};

function emptyDay(day: string): SiteTrafficDay {
  return { day, clicks: 0, uniqueClickThroughs: 0, dwells: 0 };
}

export function siteTrafficFromMail(mail: MailForSiteTraffic[]): SiteTrafficDay[] {
  const byDay = new Map<string, { clicks: number; dwells: number; clickMails: Set<string> }>();

  const bucket = (day: string) => {
    let row = byDay.get(day);
    if (!row) {
      row = { clicks: 0, dwells: 0, clickMails: new Set() };
      byDay.set(day, row);
    }
    return row;
  };

  for (const item of mail) {
    const id = String(item.id || "");
    for (const click of item.clicks || []) {
      if (!click.at || !isStrataSiteUrl(click.url)) continue;
      const row = bucket(londonDateKey(click.at));
      row.clicks += 1;
      if (id) row.clickMails.add(id);
    }
    for (const dwell of item.dwells || []) {
      if (!dwell.at) continue;
      bucket(londonDateKey(dwell.at)).dwells += 1;
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, row]) => ({
      day,
      clicks: row.clicks,
      uniqueClickThroughs: row.clickMails.size,
      dwells: row.dwells,
    }));
}

export function mergeSiteTrafficDays(
  persisted: SiteTrafficDay[],
  live: SiteTrafficDay[]
): SiteTrafficDay[] {
  const byDay = new Map<string, SiteTrafficDay>();
  for (const row of [...persisted, ...live]) {
    const prev = byDay.get(row.day);
    if (!prev) {
      byDay.set(row.day, { ...row });
      continue;
    }
    byDay.set(row.day, {
      day: row.day,
      clicks: Math.max(prev.clicks, row.clicks),
      uniqueClickThroughs: Math.max(prev.uniqueClickThroughs, row.uniqueClickThroughs),
      dwells: Math.max(prev.dwells, row.dwells),
    });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function fillSiteTrafficWindow(
  days: SiteTrafficDay[],
  now: Date = new Date(),
  windowDays = 30
): SiteTrafficDay[] {
  const byDay = new Map(days.map((row) => [row.day, row]));
  const end = londonDateKey(now.toISOString());
  const endUtc = Date.parse(`${end}T12:00:00.000Z`);
  const filled: SiteTrafficDay[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = londonDateKey(new Date(endUtc - i * 24 * 60 * 60 * 1000).toISOString());
    filled.push(byDay.get(day) ?? emptyDay(day));
  }
  return filled;
}
