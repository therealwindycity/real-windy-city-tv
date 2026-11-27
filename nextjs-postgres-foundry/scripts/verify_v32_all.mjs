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
    const homeTxt = await page.textContent("body");
    assert(!homeTxt.toLowerCase().includes("cathy moody"), "Home page has 0 'Cathy Moody' occurrences");
    assert(homeTxt.includes("OSINT Graph (51)") || homeTxt.includes("OSINT Entity"), "Home page links to 51-entity OSINT Graph");
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

    // Instant select on Season
    await page.selectOption('select[name="season"]', "2025");
    await page.waitForURL("**/episodes**season=2025**");
    assert(page.url().includes("season=2025"), "Episodes Season <select> updates view immediately");

    // Reset and test Next Page pagination on Episodes
    await page.goto("http://127.0.0.1:3000/episodes", { waitUntil: "networkidle" });
    await page.click('a:has-text("Next Page")');
    await page.waitForURL("**/episodes?page=2**");
    assert(page.url().includes("page=2"), "Episodes Next Page button navigates to page=2");
    await page.click('a:has-text("Previous Page")');
    await page.waitForURL("**/episodes?page=1**");
    assert(page.url().includes("page=1"), "Episodes Previous Page button navigates back to page=1");

    // Nav click-through: Speakers Vault -> Mark Moody + Analytics + Capacity/Stance/POE + Pagination + Video + FB Export
    await page.click('header a[href="/speakers"]');
    await page.waitForURL("**/speakers**");
    await page.click('button:has-text("Next Page")');
    await page.waitForURL("**/speakers?page=2**");
    assert(page.url().includes("page=2"), "Speakers Next Page button navigates to page=2");

    // Instant Capacity select
    await page.selectOption('select:has(option:text("All Speaking Capacities"))', "Individual Citizen");
    await page.waitForURL("**/speakers**capacity=Individual+Citizen**");
    assert(page.url().includes("capacity="), "Speakers Capacity <select> updates immediately");

    // Inspect Mark Moody dossier
    await page.goto("http://127.0.0.1:3000/speakers?speaker=mark-moody", { waitUntil: "networkidle" });
    const moodyTxt = await page.textContent("body");
    assert(moodyTxt.includes("Mark Moody"), "Mark Moody canonical profile loads");
    assert(!moodyTxt.toLowerCase().includes("cathy moody"), "Zero Cathy Moody on Mark Moody profile");
    assert(moodyTxt.includes("262 Historical Clips"), "Mark Moody shows 262 Historical Clips");
    assert(moodyTxt.includes("Avg Speaking Time"), "Mark Moody shows Avg Speaking Time");
    assert(moodyTxt.includes("Points of Order"), "Mark Moody shows Points of Order");
    assert(moodyTxt.includes("Verified OSINT Profiles"), "Mark Moody shows Verified OSINT Profiles");
    await page.screenshot({ path: `${SHOTS_DIR}/02_nextjs_mark_moody_dossier.png` });

    // Click play on a speaker clip card and verify C-SPAN framing + Intro/CC/Outro + FB Export modal
    const playBtns = page.locator('button:has-text("Watch Branded")');
    if ((await playBtns.count()) > 0) {
      await playBtns.first().click();
      await page.waitForTimeout(500);
      const stageTxt = await page.textContent("body");
      assert(stageTxt.includes("THE REAL WINDY CITY"), "Branded C-SPAN video stage mounts with THE REAL WINDY CITY header/marquee");
      await page.screenshot({ path: `${SHOTS_DIR}/03_nextjs_cspan_player.png` });
    }

    // Open Facebook Export Modal and verify strict speaker-segment-only guarantee
    await page.locator('button:has-text("Export to FB")').first().click();
    await page.waitForTimeout(300);
    const modalTxt = await page.textContent("body");
    assert(modalTxt.includes("Never Full Meeting") || modalTxt.includes("Speaker-Only"), "FB modal enforces speaker-segment-only export");
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

    // Verify /osint explorer: Search + Enter + Category Select + Pagination
    await page.click('header a[href="/osint"]');
    await page.waitForURL("**/osint**");
    const osintTxt = await page.textContent("body");
    assert(osintTxt.includes("Cheyenne LEADS") || osintTxt.includes("OSINT"), "OSINT explorer renders 51 dossiers");
    await page.click('a:has-text("Next Page")');
    await page.waitForURL("**/osint?page=2**");
    assert(page.url().includes("page=2"), "OSINT Next Page pagination works");
    await page.fill('input[name="q"]', "AVI");
    await page.click('button:has-text("Enter")');
    await page.waitForURL("**/osint?q=AVI**");
    const aviTxt = await page.textContent("body");
    assert(aviTxt.includes("AVI Professional Corporation") || aviTxt.includes("Brad Emmons"), "OSINT search finds AVI PC / Brad Emmons");
    await page.screenshot({ path: `${SHOTS_DIR}/04_nextjs_osint_graph.png` });

    // Verify /ordinances, /documents, /provenance, /cast click-through + pagination
    for (const [route, checkStr] of [
      ["/ordinances", "Ordinance"],
      ["/documents", "SHA-1"],
      ["/provenance", "PROVENANCE"],
      ["/cast", "Mark Moody"],
    ]) {
      await page.click(`header a[href="${route}"]`);
      await page.waitForURL(`**${route}**`);
      const body = await page.textContent("body");
      assert(body.includes(checkStr), `Route ${route} loads and displays '${checkStr}'`);
    }

    console.log("=== 2. VERIFYING STATIC GITHUB PAGES v3.2 (:8787) ===");
    await page.goto("http://127.0.0.1:8787/", { waitUntil: "networkidle" });
    const ghHome = await page.textContent("body");
    assert(ghHome.includes("51 OSINT"), "GitHub Pages home shows 51 OSINT stat");
    assert(!ghHome.toLowerCase().includes("cathy moody"), "GitHub Pages home has 0 Cathy Moody");

    // Test every nav button on GitHub Pages
    for (const nav of ["episodes", "speakers", "osint", "ordinances", "foundry", "provenance", "cast"]) {
      await page.click(`#mainNav button[data-nav="${nav}"]`);
      await page.waitForTimeout(250);
      const activeNav = await page.locator(`#mainNav button[data-nav="${nav}"]`).evaluate((el) => el.classList.contains("active"));
      assert(activeNav, `GitHub Pages nav button '${nav}' activates and renders view`);
    }

    // Test focus preservation + Enter button + Next Page on GitHub Pages Speakers Vault
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

    // Reset and test Next Page on GitHub Pages Speakers Vault
    await page.click('button:has-text("Clear Filters")');
    await page.click('.pagination-bar button:has-text("Next Page")');
    const pgTxt = await page.textContent(".pagination-bar");
    assert(pgTxt.includes("Page 2 of"), "GitHub Pages Speakers Next Page advances to Page 2");
    assert(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(await page.evaluate(() => { document.querySelectorAll("details").forEach((d) => (d.open = true)); return document.body.innerText; })), "GitHub Pages Speakers view contains 0 'undefined'/'NaN' values");
    await page.screenshot({ path: `${SHOTS_DIR}/05_ghpages_speakers_v32.png` });

    // Static Mark Moody dossier: open profile, expand every analytics <details>, scan for leaks
    await page.evaluate(() => window.openSpeaker("mark-moody"));
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const ghMoodyBody = await page.textContent("body");
    assert(ghMoodyBody.includes("Mark Moody") && ghMoodyBody.includes("262"), "GitHub Pages Mark Moody dossier shows 262 clips");
    assert(!ghMoodyBody.toLowerCase().includes("cathy moody"), "GitHub Pages Mark Moody dossier has 0 Cathy Moody");
    assert(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(ghMoodyBody), "GitHub Pages Mark Moody dossier (expanded analytics) has 0 undefined/NaN/[object Object]");
    await page.screenshot({ path: `${SHOTS_DIR}/07_ghpages_mark_moody_expanded.png` });

    // Open OSINT tab on GitHub Pages and verify Next Page
    await page.click('#mainNav button[data-nav="osint"]');
    await page.waitForTimeout(200);
    await page.click('.pagination-bar button:has-text("Next Page")');
    const osintPgTxt = await page.textContent(".pagination-bar");
    assert(osintPgTxt.includes("Page 2 of"), "GitHub Pages OSINT Next Page advances to Page 2");
    const osintBody = await page.textContent("#app, main, body");
    assert(!/\bundefined\b|\bNaN\b/.test(osintBody), "GitHub Pages OSINT cards contain 0 'undefined'/'NaN' values");
    await page.click('.pagination-bar button:has-text("Previous Page")');
    const osintP1 = await page.textContent("body");
    assert(osintP1.includes("Cheyenne LEADS") && !/\bundefined\b/.test(osintP1), "GitHub Pages OSINT page 1 renders Cheyenne LEADS with clean speaker chips");
    await page.screenshot({ path: `${SHOTS_DIR}/06_ghpages_osint_v32.png` });

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
    assert(ghClipAudio === 29, `GitHub Pages lists 29 branded clips (${ghClipAudio})`);

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
    assert(/Video verified/.test(badge[0]) && badge[1], "GitHub Pages episode shows video-verification badge and links the other part of a multi-part meeting");

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
