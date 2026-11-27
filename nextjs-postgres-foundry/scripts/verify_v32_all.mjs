import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(process.env.PW_PKG || import.meta.url);
const { chromium } = require("playwright");

const STATIC_ROOT = "/tmp/rwc_tv_deploy";
const SHOTS_DIR = "/tmp/v32_verification_shots";
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

function startStaticServer(port = 8787) {
  const srv = http.createServer((req, res) => {
    const clean = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = clean === "/" ? "/index.html" : clean;
    const fp = path.join(STATIC_ROOT, rel);
    if (!fp.startsWith(STATIC_ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.setHeader("Content-Type", MIME[path.extname(fp)] || "application/octet-stream");
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise((resolve) => srv.listen(port, "127.0.0.1", () => resolve(srv)));
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ✓", msg);
}

async function main() {
  const staticSrv = await startStaticServer(8787);
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      console.error("  [PAGEERROR]", page.url(), e.message);
      pageErrors.push(e.message);
    });

    console.log("=== 1. VERIFYING NEXT.JS 16 + POSTGRESQL 17 (:3000) ===");
    await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
    const homeTxt = await page.innerText("body");
    assert(!homeTxt.toLowerCase().includes("cathy moody"), "Home page has 0 'Cathy Moody' occurrences");
    assert(homeTxt.includes("Who's Who"), "Home page links to Who's Who");
    assert(!/C-SPAN|OSINT|Palantir|Foundry|Gotham|Ontology/i.test(homeTxt), "Home page has no jargon (C-SPAN/OSINT/Palantir/Foundry/Gotham/Ontology)");
    await page.screenshot({ path: `${SHOTS_DIR}/01_nextjs_home.png` });

    // Nav click-through: Episodes -> Search + Enter + Instant Select + Pagination
    await page.click('header a[href="/episodes"]');
    await page.waitForURL("**/episodes**");
    const epInput = page.locator('input[name="q"]');
    await epInput.click();
    await epInput.type("Council", { delay: 15 });
    const focusedTag = await page.evaluate(() => document.activeElement?.getAttribute("name"));
    assert(focusedTag === "q", "Episodes search input preserves focus while typing");
    await page.click('button:has-text("Enter")');
    await page.waitForURL("**/episodes?q=Council**");
    assert(page.url().includes("q=Council"), "Episodes Enter button submits search");

    // Instant select on year
    await page.selectOption('select[name="season"]', "2025");
    await page.waitForURL("**/episodes**season=2025**");
    assert(page.url().includes("season=2025"), "Meetings year <select> updates view immediately");

    // Reset and test Next Page pagination on Episodes
    await page.goto("http://127.0.0.1:3000/episodes", { waitUntil: "networkidle" });
    await page.click('a:has-text("Next Page")');
    await page.waitForURL("**/episodes?page=2**");
    assert(page.url().includes("page=2"), "Episodes Next Page button navigates to page=2");
    await page.click('a:has-text("Previous Page")');
    await page.waitForURL("**/episodes?page=1**");
    assert(page.url().includes("page=1"), "Episodes Previous Page button navigates back to page=1");

    // Nav click-through: Speaker clips -> Mark Moody + role/for-against/points of order + pagination + video + Facebook share
    await page.click('header a[href="/speakers"]');
    await page.waitForURL("**/speakers**");
    await page.click('button:has-text("Next Page")');
    await page.waitForURL("**/speakers?page=2**");
    assert(page.url().includes("page=2"), "Speakers Next Page button navigates to page=2");

    // Instant Capacity select
    await page.selectOption('select:has(option:text("Anyone (any role)"))', "Resident");
    await page.waitForURL("**/speakers**capacity=Resident**");
    assert(page.url().includes("capacity="), "Speakers role <select> updates immediately");
    assert(!(await page.innerText("body")).includes("No clips match") && (await page.locator('button:has-text("Share on Facebook")').count()) > 0, "Filtering by role 'Resident' returns clips");

    // Inspect Mark Moody profile
    await page.goto("http://127.0.0.1:3000/speakers?speaker=mark-moody", { waitUntil: "networkidle" });
    const moodyTxt = await page.innerText("body");
    assert(moodyTxt.includes("Mark Moody"), "Mark Moody profile loads");
    assert(!moodyTxt.toLowerCase().includes("cathy moody"), "Zero Cathy Moody on Mark Moody profile");
    assert(moodyTxt.includes("262 clips"), "Mark Moody shows 262 clips");
    assert(moodyTxt.includes("Usually speaks for"), "Mark Moody shows usual speaking time");
    assert(moodyTxt.includes("Points of order"), "Mark Moody shows points of order");
    assert(moodyTxt.includes("Public profiles"), "Mark Moody shows public profiles");
    assert(!/C-SPAN|OSINT|Canonical|Dossier|Vault/i.test(moodyTxt), "Speaker page has no jargon (C-SPAN/OSINT/Canonical/Dossier/Vault)");
    await page.screenshot({ path: `${SHOTS_DIR}/02_nextjs_mark_moody_profile.png` });

    // Click play on a speaker clip card and verify the framed player + Facebook share window
    const playBtns = page.locator('button:has-text("-second clip")');
    if ((await playBtns.count()) > 0) {
      await playBtns.first().click();
      await page.waitForTimeout(500);
      const stageTxt = await page.innerText("body");
      assert(stageTxt.includes("THE REAL WINDY CITY"), "Framed video player mounts with THE REAL WINDY CITY header");
      await page.screenshot({ path: `${SHOTS_DIR}/03_nextjs_clip_player.png` });
    }

    // Open the Facebook share window and verify it offers only the speaker's clip
    await page.locator('button:has-text("Share on Facebook")').first().click();
    await page.waitForTimeout(300);
    const modalTxt = await page.innerText("body");
    assert(modalTxt.toLowerCase().includes("share this speaker clip on facebook") && modalTxt.includes("-second clip"), "Facebook window offers only the speaker's clip");
    const dlHref = await page.locator('a[href*="/api/clips/"]').first().getAttribute("href");
    assert(dlHref && dlHref.includes("/api/clips/") && !dlHref.includes("archive.org/download/cochwy"), `Clip download href is strictly speaker-segment (${dlHref})`);
    await page.click('button:has-text("✕ Close")');

    // Verify /api/clips/13?download=1 returns real <=3m speaker MP4 (not full meeting!)
    const clipHead = execFileSync("curl", ["-sI", "http://127.0.0.1:3000/api/clips/13?download=1"]).toString();
    assert(clipHead.includes("200 OK") && clipHead.toLowerCase().includes("video/mp4"), "/api/clips/13?download=1 returns 200 OK video/mp4");
    const probeDur = parseFloat(
      execFileSync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
        "http://127.0.0.1:3000/api/clips/13?download=1"
      ]).toString().trim()
    );
    assert(probeDur > 10 && probeDur <= 192, `/api/clips/13 duration is ${probeDur.toFixed(1)}s (strict <=3m speaker clip + intro/outro, never full meeting)`);

    // Verify Who's Who: search + Enter + category + pagination
    await page.click('header a[href="/osint"]');
    await page.waitForURL("**/osint**");
    const osintTxt = await page.innerText("body");
    assert(osintTxt.includes("Cheyenne LEADS") && osintTxt.toLowerCase().includes("who's who"), "Who's Who renders profiles");
    assert(!/OSINT|Dossier|Entity|Entities/.test(osintTxt), "Who's Who page has no jargon (OSINT/Dossier/Entity)");
    await page.click('a:has-text("Next Page")');
    await page.waitForURL("**/osint?page=2**");
    assert(page.url().includes("page=2"), "Who's Who Next Page works");
    await page.fill('input[name="q"]', "AVI");
    await page.click('button:has-text("Enter")');
    await page.waitForURL("**/osint?q=AVI**");
    const aviTxt = await page.innerText("body");
    assert(aviTxt.includes("AVI Professional Corporation") || aviTxt.includes("Brad Emmons"), "Who's Who search finds AVI PC / Brad Emmons");
    await page.screenshot({ path: `${SHOTS_DIR}/04_nextjs_whos_who.png` });

    // Verify /ordinances, /documents, /provenance, /cast click-through + pagination
    for (const [route, checkStr] of [
      ["/ordinances", "Ordinance"],
      ["/documents", "MEETING DOCUMENTS"],
      ["/provenance", "Where the records come from"],
      ["/cast", "Mark Moody"],
    ]) {
      await page.click(`header a[href="${route}"]`);
      await page.waitForURL(`**${route}**`);
      const body = await page.innerText("body");
      assert(body.toLowerCase().includes(checkStr.toLowerCase()), `Route ${route} loads and displays '${checkStr}'`);
      assert(!/C-SPAN|OSINT|Palantir|Foundry|Gotham|Ontology|SHA-1|Datum|Provenance/.test(body), `Route ${route} has no jargon`);
    }

    console.log("=== 2. VERIFYING STATIC GITHUB PAGES v3.2 (:8787) ===");
    await page.goto("http://127.0.0.1:8787/", { waitUntil: "networkidle" });
    const ghHome = await page.innerText("body");
    assert(ghHome.includes("Who's Who") && !/C-SPAN|OSINT|Palantir|Foundry|Gotham/i.test(ghHome), "GitHub Pages home shows Who's Who and no jargon");
    assert(!ghHome.toLowerCase().includes("cathy moody"), "GitHub Pages home has 0 Cathy Moody");

    // Test every nav button on GitHub Pages
    for (const nav of ["episodes", "speakers", "osint", "ordinances", "foundry", "provenance", "cast"]) {
      await page.click(`#mainNav button[data-nav="${nav}"]`);
      await page.waitForTimeout(250);
      const activeNav = await page.locator(`#mainNav button[data-nav="${nav}"]`).evaluate((el) => el.classList.contains("active"));
      assert(activeNav, `GitHub Pages nav button '${nav}' activates and renders view`);
    }

    // Test focus preservation + Enter button + Next Page on GitHub Pages Speaker Clips
    await page.click('#mainNav button[data-nav="speakers"]');
    await page.waitForTimeout(200);
    const spkInp = page.locator("#spkSearchInput");
    await spkInp.click();
    await spkInp.type("Moody", { delay: 20 });
    const activeId = await page.evaluate(() => document.activeElement?.id);
    assert(activeId === "spkSearchInput", "GitHub Pages #spkSearchInput preserves focus across oninput updates");
    await page.click('form:has(#spkSearchInput) button[type="submit"]');
    const ghMoody = await page.textContent("#spkResultsBox");
    assert(ghMoody.includes("Mark Moody"), "GitHub Pages Speakers search + Enter finds Mark Moody");

    // Reset and test Next Page on GitHub Pages Speaker Clips
    await page.click('button:has-text("Clear filters")');
    await page.click('.pagination-bar button:has-text("Next Page")');
    const pgTxt = await page.textContent(".pagination-bar");
    assert(pgTxt.includes("Page 2 of"), "GitHub Pages Speakers Next Page advances to Page 2");
    assert(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(await page.evaluate(() => { document.querySelectorAll("details").forEach((d) => (d.open = true)); return document.body.innerText; })), "GitHub Pages Speakers view contains 0 'undefined'/'NaN' values");
    await page.screenshot({ path: `${SHOTS_DIR}/05_ghpages_speakers_v32.png` });

    // Static Mark Moody profile: open it, expand every <details>, scan for leaks
    await page.evaluate(() => window.openSpeaker("mark-moody"));
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const ghMoodyBody = await page.innerText("body");
    assert(ghMoodyBody.includes("Mark Moody") && ghMoodyBody.includes("262"), "GitHub Pages Mark Moody profile shows 262 clips");
    assert(!ghMoodyBody.toLowerCase().includes("cathy moody"), "GitHub Pages Mark Moody profile has 0 Cathy Moody");
    assert(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(ghMoodyBody), "GitHub Pages Mark Moody profile (expanded) has 0 undefined/NaN/[object Object]");
    assert(!/C-SPAN|OSINT|dossier|diariz/i.test(ghMoodyBody), "GitHub Pages Mark Moody profile has no jargon");
    await page.screenshot({ path: `${SHOTS_DIR}/07_ghpages_mark_moody_expanded.png` });

    // Open Who's Who on GitHub Pages and verify Next Page
    await page.click('#mainNav button[data-nav="osint"]');
    await page.waitForTimeout(200);
    await page.click('.pagination-bar button:has-text("Next Page")');
    const osintPgTxt = await page.textContent(".pagination-bar");
    assert(osintPgTxt.includes("Page 2 of"), "GitHub Pages Who's Who Next Page advances to Page 2");
    const osintBody = await page.textContent("#app, main, body");
    assert(!/\bundefined\b|\bNaN\b/.test(osintBody), "GitHub Pages Who's Who cards contain 0 'undefined'/'NaN' values");
    await page.click('.pagination-bar button:has-text("Previous Page")');
    const osintP1 = await page.innerText("body");
    assert(osintP1.includes("Cheyenne LEADS") && !/\bundefined\b/.test(osintP1), "GitHub Pages Who's Who page 1 renders Cheyenne LEADS with clean speaker chips");
    await page.screenshot({ path: `${SHOTS_DIR}/06_ghpages_whos_who.png` });

    // v3.2.1 re-timing: verified clips seek to the transcript-verified moment; unverifiable turns never play a wrong moment
    const retime = await page.evaluate(() => {
      const t = window.DB.turnById.get(1121), r = window.DB.turnById.get(34), y = window.DB.turnById.get(206);
      const out = { t1121: [t.startSec, t.videoTiming], removedSrc: r.sourceMeetingMp4Url, removedTiming: r.videoTiming, yt: y.youtubeId, ytSrc: y.sourceMeetingMp4Url };
      const host = document.createElement("div"); host.id = "e2eRetimeHost"; document.body.appendChild(host);
      window.mountTurnVideo(34, "e2eRetimeHost"); out.removedHtml = host.innerHTML;
      window.mountTurnVideo(206, "e2eRetimeHost"); out.ytHtml = host.innerHTML;
      host.remove();
      return out;
    });
    assert(retime.t1121[0] === 576.6 && retime.t1121[1] === "realigned", "GitHub Pages turn 1121 starts on the speaker (576.6s: transcript-verified 569.9s minus the chair's 6.7s call; was 2216.0s)");
    assert(retime.removedTiming === "removed" && !retime.removedSrc && !/<video/.test(retime.removedHtml) && /Transcript only/.test(retime.removedHtml), "GitHub Pages unverifiable turn shows 'Transcript only' and never plays a wrong moment");
    assert(retime.yt === "ehK-YMrWJBo" && !retime.ytSrc && /youtube-nocookie\.com\/embed\/ehK-YMrWJBo\?start=498/.test(retime.ytHtml), "GitHub Pages 11-17-26 turn plays YouTube original at the verified timestamp (IA copy corrupt)");
    const ghClipAudio = await page.evaluate(() => [...window.DB.turnById.values()].filter((t) => t.brandedMp4Url).length);
    assert(ghClipAudio === 25, `GitHub Pages lists 25 branded clips (${ghClipAudio})`);

    // A1 meeting-link verification: IA-upload-date ghost episodes removed, wrong-date links removed, badge shown
    const a1 = await page.evaluate(() => ({
      n: window.DB.episodes.length,
      ghost: window.DB.epBySlug.has("2018-03-13-council"),
      wrong: (window.DB.epBySlug.get("2025-08-11-council") || {}).mp4Url || null,
      basisReal: (window.DB.epBySlug.get("2018-03-12-council") || {}).videoLinkBasis
    }));
    assert(a1.n === 1583 && !a1.ghost, `GitHub Pages: 32 IA-upload-date ghost episodes removed (${a1.n} episodes)`);
    assert(a1.wrong === null, "GitHub Pages: 2025-08-11 council no longer plays the 2024-08-11 recording");
    await page.evaluate(() => { STATE.epSlug = "2018-02-26-council"; window.rerenderEpisode(); });
    const badge = await page.evaluate(() => [(document.querySelector(".video-basis") || {}).textContent || "", document.getElementById("appRoot").innerHTML.includes("part_2_2_26_18")]);
    assert(/Right video/.test(badge[0]) && badge[1], "GitHub Pages episode shows video-verification badge and links the other part of a multi-part meeting");

    assert(pageErrors.length === 0, `Zero uncaught browser JS errors (${pageErrors.length})`);
    console.log("\nALL E2E CHECKS PASSED ACROSS NEXT.JS (:3000) AND GITHUB PAGES (:8787)!");
  } finally {
    await browser.close();
    staticSrv.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
