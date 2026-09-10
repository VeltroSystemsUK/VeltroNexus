import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "tmp", "motion-lab");
const URL = process.env.MOTION_LAB_URL || "http://localhost:5000/motion-lab";
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function stripPng(looks) {
  return looks.map(({ restPng, clickPng, midPng, ...rest }) => rest);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--window-size=1600,1200"],
    defaultViewport: { width: 1600, height: 1200 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(
      () => document.documentElement.dataset.motionLab === "done" && window.__MOTION_LAB__?.done,
      { timeout: 180000 },
    );
  } catch (err) {
    await page.screenshot({ path: path.join(OUT, "timeout.png"), fullPage: true }).catch(() => {});
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || "");
    await writeFile(path.join(OUT, "timeout.txt"), `${body}\n\nERRORS:\n${errors.join("\n")}`);
    throw err;
  }
  const report = await page.evaluate(() => window.__MOTION_LAB__);
  for (const look of report.looks) {
    const rest = look.restPng.replace(/^data:image\/png;base64,/, "");
    const click = look.clickPng.replace(/^data:image\/png;base64,/, "");
    await writeFile(path.join(OUT, `${look.id}-rest.png`), Buffer.from(rest, "base64"));
    await writeFile(path.join(OUT, `${look.id}-click.png`), Buffer.from(click, "base64"));
  }
  for (const tween of report.tweens) {
    const rest = tween.restPng.replace(/^data:image\/png;base64,/, "");
    const mid = tween.midPng.replace(/^data:image\/png;base64,/, "");
    await writeFile(path.join(OUT, `tween-${tween.id}-rest.png`), Buffer.from(rest, "base64"));
    await writeFile(path.join(OUT, `tween-${tween.id}-mid.png`), Buffer.from(mid, "base64"));
  }
  await page.screenshot({ path: path.join(OUT, "grid.png"), fullPage: true });
  const summary = {
    at: new Date().toISOString(),
    errors,
    flaggedLooks: report.looks.filter((look) => look.issues.length),
    flaggedTweens: report.tweens.filter((tween) => tween.issues.length),
    looks: stripPng(report.looks),
    tweens: stripPng(report.tweens),
  };
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  const failCount = summary.flaggedLooks.length + summary.flaggedTweens.length;
  console.log(`LOOKS ${report.looks.length} TWEENS ${report.tweens.length} FLAGGED ${failCount} ERRORS ${errors.length}`);
  for (const look of summary.flaggedLooks) {
    console.log(`FLAG ${look.id} ${look.issues.join(",")} paper=${look.paperRatio} loop=${look.loopMae} click=${look.clickMae}`);
  }
  for (const tween of summary.flaggedTweens) {
    console.log(`FLAG tween:${tween.id} ${tween.issues.join(",")} mid=${tween.midMae}`);
  }
  if (errors.length) console.log(`CONSOLE ${errors.slice(0, 8).join(" | ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
