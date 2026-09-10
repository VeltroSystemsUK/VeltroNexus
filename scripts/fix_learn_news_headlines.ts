import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { withJsonFileLock } from "../server/utils/jsonFileLock";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "uploads", "local_collections_store.json");

const POLITICS_06 = {
  title: "A party that cannot control its own donations",
  excerpt:
    "Reform is in a donations row. Farage said he wasn't even listening. If the people selling the story cannot keep their own money straight, ask who is paid before you sign.",
  body: `Reform UK is in another donations row. Farage told reporters he "wasn't even listening". Critics say the party is out of control. The polls slipped the same week.

That is one story, not five. The desk question is the same one we ask of a warehouse broker: if you cannot keep your own money straight, why would anyone hand you theirs?

Ask who is paid, and for what, before you sign. Strata packages UK SME distress-refinance files. It does not lend.

Source: The Guardian, https://www.theguardian.com/politics
Source: The Independent, https://www.the-independent.com/news/uk/politics
Source: BBC, https://www.bbc.co.uk/news/politics
`,
};

const POLITICS_07 = {
  title: "Whitehall is paying off a council's £2bn",
  excerpt:
    "The government has started paying down a council's books. Directors sitting on stacked facilities do not get that treatment.",
  body: `The BBC says the government has begun paying off a council's £2bn debt. The same week the Chancellor is lining up a £150m "fast-track" economic fund.

Westminster will also give you Lords reform and a march in Dover. Those are other stories. This one is cash: a public body that cannot service its own books gets socialised. A company on three collectors does not.

Map the collectors before anyone sells you a rescue. Strata packages UK SME distress-refinance files. It does not lend.

Source: BBC, https://www.bbc.co.uk/news/politics
Source: Sky News, https://news.sky.com/story/politics-latest-burnham-labour-farage-badenoch-reform-macron-12593360
`,
};

const COMMERCIAL_07 = {
  title: "SME lending is up. Small loans are not.",
  excerpt:
    "UK Finance says gross SME lending is at a five-year high. Brokers still say the small tickets are the ones that will not clear.",
};

const ECONOMY_07 = {
  title: "The Bank held. Inflation is still above target.",
  excerpt:
    "The Monetary Policy Committee left Bank Rate unchanged. CPI is still above the two-percent target. Energy is the risk they keep naming.",
};

function patchNews(
  pieces: any[],
  slug: string,
  patch: { title?: string; excerpt?: string; body?: string; live?: boolean },
) {
  const row = pieces.find((item) => item.slug === slug && item.kind === "news");
  if (!row) {
    console.log(`missing ${slug}`);
    return;
  }
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });
  console.log(`patched ${slug} -> ${row.live === false ? "unpublished" : row.title}`);
}

function stripH1(body: string, title: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.startsWith("# ") && lines[0].replace(/^#\s+/, "").trim() === title.trim()) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return body;
}

function main() {
  withJsonFileLock(STORE, () => {
    const data = JSON.parse(readFileSync(STORE, "utf8"));
    const pieces = data.learn_pieces || [];
    patchNews(pieces, "uk-politics-2026-09-06", POLITICS_06);
    patchNews(pieces, "uk-politics-2026-09-07", POLITICS_07);
    const commercial = pieces.find((row: any) => row.slug === "uk-commercial-finance-2026-09-07");
    if (commercial) {
      commercial.title = COMMERCIAL_07.title;
      commercial.excerpt = COMMERCIAL_07.excerpt;
      commercial.body = stripH1(commercial.body, "UK Commercial Finance — 2026-09-07");
      commercial.updatedAt = new Date().toISOString();
      console.log("patched uk-commercial-finance-2026-09-07");
    }
    const economy = pieces.find((row: any) => row.slug === "uk-economy-2026-09-07");
    if (economy) {
      economy.title = ECONOMY_07.title;
      economy.excerpt = ECONOMY_07.excerpt;
      economy.body = stripH1(economy.body, "UK Economy — 2026-09-07");
      economy.updatedAt = new Date().toISOString();
      console.log("patched uk-economy-2026-09-07");
    }
    patchNews(pieces, "uk-commercial-finance-2026-09-06", { live: false });
    data.learn_pieces = pieces;
    writeFileSync(STORE, JSON.stringify(data, null, 2));
  });
}

main();
