/* The Real Windy City v3.0 — Unified Broadcast, Palantir Gotham/Foundry, Speaker-Turn FB Studio & Provenance Engine */
(function () {
  "use strict";

  const LENSES = [
    { key: "foundry", name: "Foundry Docs Vault", icon: "🧬", accent: "#38bdf8", group: "Verify", blurb: "Palantir Foundry workbench: all Agendas & Supporting PDFs, SHA-1 hashes & live AI-Record-OCR." },
    { key: "gotham", name: "Gotham Link Graph", icon: "🕸️", accent: "#10b981", group: "Follow", blurb: "Palantir Gotham entity-link graph connecting Officials, Ordinances, PDFs, $ Flows & Speakers." },
    { key: "speakers", name: "Speaker Turn Videos", icon: "🎙️", accent: "#f59e0b", group: "Watch", blurb: "Individual <=3-min speaker turn videos with emotion/theme tags, speaker .ZIP & Facebook studio." },
    { key: "provenance", name: "Provenance Films", icon: "🎥", accent: "#f43f5e", group: "Verify", blurb: "Screen-recorded walkthroughs showing the exact manual browser clicks used to obtain records." },
    { key: "story", name: "Plain-English Story", icon: "📖", accent: "#fbbf24", group: "Watch", blurb: "What happened, why it matters, and a 4-stop curiosity dial from headline to kid mode." },
    { key: "tabloid", name: "Front Page", icon: "🗞️", accent: "#ef4444", group: "Watch", blurb: "Screaming tabloid headlines with every claim footnoted back to the official packet." },
    { key: "cast", name: "Cast & Crew", icon: "🎭", accent: "#a855f7", group: "Watch", blurb: "Presiding officials, council sponsors, dissenters, and public commenters on the floor." },
    { key: "callsheet", name: "Run of Show", icon: "🎬", accent: "#38bdf8", group: "Watch", blurb: "The agenda cut into TV acts — click any item for sponsor, recommended action & ceiling." },
    { key: "votes", name: "Vote Lab", icon: "🗳️", accent: "#22c55e", group: "Follow", blurb: "Every recorded motion in the minutes, unanimous vs split tallies, and dissenting votes." },
    { key: "map", name: "Cheyenne Map", icon: "🗺️", accent: "#14b8a6", group: "Follow", blurb: "Parcel & corridor schematic linking rezones, annexations, plats & infrastructure." },
    { key: "history", name: "History Compare", icon: "🕰️", accent: "#f97316", group: "Follow", blurb: "Every ordinance on tonight's docket traced across its 1st, 2nd & 3rd readings." },
    { key: "money", name: "Follow the Money", icon: "💵", accent: "#84cc16", group: "Follow", blurb: "Every dollar contract, bid, grant & appropriation ranked and cited." },
    { key: "jargon", name: "Jargon Decoder", icon: "🔤", accent: "#ec4899", group: "Follow", blurb: "UDC, NTE, Consent Agenda, BOPU, 6th Penny, Substitute — municipal terms decoded." },
    { key: "legal", name: "Legal (IRAC)", icon: "⚖️", accent: "#8b5cf6", group: "Verify", blurb: "Issue · Rule · Application · Conclusion on ordinance readings & Wyoming Statutes." },
    { key: "factcheck", name: "Fact-Check Desk", icon: "🔍", accent: "#06b6d4", group: "Verify", blurb: "Deterministic packet briefs, extracted key-value telemetry & severity flags." },
    { key: "analytics", name: "Analytics", icon: "📊", accent: "#eab308", group: "Verify", blurb: "Docket composition, consent ratio, fiscal totals & dissent metrics." },
    { key: "transcript", name: "Verbatim Record", icon: "📜", accent: "#cbd5e1", group: "Verify", blurb: "Full searchable official minutes, diarized floor transcript & packet excerpts." },
    { key: "script", name: "Screenplay", icon: "✍️", accent: "#fda4af", group: "Watch", blurb: "Formatted shooting script with sluglines, clerk motions & verbatim floor quotes." },
    { key: "evidence", name: "Evidence Locker", icon: "🗄️", accent: "#94a3b8", group: "Verify", blurb: "Primary Granicus/Wayback/Archive.org URLs, Speaker .ZIP releases & SHA-1 hashes." }
  ];

  const EMOTIONS = {
    impactful: { label: "Emotionally Impactful", icon: "🔥", cls: "tag-amber" },
    angry: { label: "Angry / Gaveled / Point of Order", icon: "😠", cls: "tag-rose" },
    concerned: { label: "Concerned / Urgent", icon: "😟", cls: "tag-amber" },
    legal: { label: "Legal / Statutory Challenge", icon: "⚖️", cls: "tag-violet" },
    technical: { label: "Fiscal / Staff / Technical", icon: "📊", cls: "tag-sky" },
    supportive: { label: "Supportive / Coalition", icon: "🤝", cls: "tag-emerald" }
  };

  const THEMES = {
    annexation: "Annexation & Boundaries",
    datacenters: "Data Centers, Power & Water",
    budget: "Budget, Taxes & 6th Penny",
    zoning: "Zoning & UDC Code",
    procedure: "Public Comment & Procedure",
    housing: "Housing, Plats & Subdivisions",
    safety: "Public Safety, Police & Fire",
    contracts: "Contracts, Bids & LEADS",
    infrastructure: "Stormwater, Roads & Parks"
  };

  const DB = {
    episodes: [],
    epBySlug: new Map(),
    seasonCache: new Map(),
    turns: [],
    turnById: new Map(),
    speakers: [],
    speakerBySlug: new Map(),
    ordinances: [],
    ordBySlug: new Map(),
    docs: null,
    provenance: null,
    people: [],
    featured: null
  };

  const STATE = {
    view: "home",
    epSlug: null,
    epLens: "foundry",
    epMode: "swipe",
    splitLeft: "foundry",
    splitRight: "speakers",
    epFilterQ: "",
    epFilterBody: "",
    epFilterSeason: "",
    spkAxis: "speaker",
    spkSlug: "",
    spkDate: "",
    spkOrd: "",
    spkTheme: "",
    spkEmotion: "",
    spkQ: "",
    spkSort: "impact",
    ordSlug: null,
    ordStageIdx: 0,
    ordQ: "",
    docQ: "",
    docRole: "",
    docOcr: false,
    selectedDocId: null,
    provActiveUrl: null,
    provActiveTitle: "",
    provActiveDesc: "",
    provQ: "",
    floats: []
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    if (!n) return "$0";
    return n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : "$" + Math.round(n).toLocaleString("en-US");
  }

  // Client-side pure-JS CRC32 + ZIP builder so GitHub Pages generates real .ZIP speaker packs at $0/mo!
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function buildZipBlob(entries) {
    const enc = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const e of entries) {
      const nb = enc.encode(e.name);
      const data = e.data instanceof Uint8Array ? e.data : enc.encode(String(e.data));
      const crc = crc32(data);
      const sz = data.length;
      const loc = new Uint8Array(30 + nb.length + sz);
      const lv = new DataView(loc.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(12, 0x5978, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, sz, true);
      lv.setUint32(22, sz, true);
      lv.setUint16(26, nb.length, true);
      loc.set(nb, 30);
      loc.set(data, 30 + nb.length);
      locals.push(loc);

      const cen = new Uint8Array(46 + nb.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(14, 0x5978, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, sz, true);
      cv.setUint32(24, sz, true);
      cv.setUint16(28, nb.length, true);
      cv.setUint32(42, offset, true);
      cen.set(nb, 46);
      centrals.push(cen);
      offset += loc.length;
    }
    const cSize = centrals.reduce((s, x) => s + x.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...locals, ...centrals, eocd], { type: "application/zip" });
  }

  window.downloadSpeakerZip = async function (speakerSlug) {
    const spk = DB.speakerBySlug.get(speakerSlug);
    if (!spk) return;
    const turns = DB.turns.filter((t) => t.speakerSlug === speakerSlug);
    const baseUrl = window.location.origin + window.location.pathname;
    const md = [
      `# ${spk.name} — Complete Cheyenne Civic Speaker Video Archive`,
      `Role: ${spk.role}`,
      `Recorded <=3-Min Turns: ${turns.length} across ${spk.meetingCount} meetings (${spk.firstDate} -> ${spk.lastDate})`,
      `Themes: ${spk.topThemes.join(", ")}`,
      ``,
      `## Ready-to-Paste Facebook Captions & Video Links`,
      ``
    ];
    const sh = [
      `#!/usr/bin/env bash`,
      `set -e`,
      `mkdir -p "${speakerSlug}_fb_clips" && cd "${speakerSlug}_fb_clips"`
    ];
    for (const t of turns) {
      const cap = `${(EMOTIONS[t.emotion] || EMOTIONS.impactful).icon} ${t.speakerName} (${t.speakerRole}) at Cheyenne ${t.bodyName} — ${t.date} [${t.hms}]\n"${t.text.slice(0, 280)}…"\n🔗 Verified Record: ${baseUrl}#speakers:${speakerSlug}\n#CheyenneWY #TheRealWindyCity #PublicRecord`;
      md.push(`### Turn #${t.id} — ${t.date} · ${t.bodyName} (${t.hms}, ${Math.round(t.durationSec)}s)`);
      if (t.directMp4Url) md.push(`- Direct MP4: ${t.directMp4Url}`);
      if (t.speakerZipUrl) md.push(`- Meeting Speaker ZIP: ${t.speakerZipUrl}`);
      md.push("```text\n" + cap + "\n```\n");
      const fn = `${t.date}_${speakerSlug}_turn${t.id}_${Math.round(t.durationSec)}s.mp4`;
      if (t.directMp4Url && t.directMp4Url.endsWith(".mp4")) sh.push(`curl -L "${t.directMp4Url}" -o "${fn}"`);
      else if (t.youtubeId) sh.push(`yt-dlp --download-sections "*${Math.floor(t.startSec)}-${Math.ceil(t.endSec)}" -f mp4 "https://www.youtube.com/watch?v=${t.youtubeId}" -o "${fn}"`);
    }
    const entries = [
      { name: `${speakerSlug}/SPEAKER_DOSSIER_AND_FB_CAPTIONS.md`, data: md.join("\n") },
      { name: `${speakerSlug}/turns_manifest.json`, data: JSON.stringify({ profile: spk, turns }, null, 2) },
      { name: `${speakerSlug}/download_all_fb_mp4_clips.sh`, data: sh.join("\n") + "\n" }
    ];
    const blob = buildZipBlob(entries);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${speakerSlug}-cheyenne-speaker-clips.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  window.playThemeSong = function () {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 440.0, 523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + i * 0.22 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.21);
    });
  };

  window.openFbModal = function (turnId) {
    const t = DB.turnById.get(Number(turnId));
    if (!t) return;
    const emo = EMOTIONS[t.emotion] || EMOTIONS.impactful;
    const shareUrl = window.location.origin + window.location.pathname + "#speakers:" + encodeURIComponent(t.speakerSlug);
    const caption = [
      `${emo.icon} ${t.speakerName} (${t.speakerRole}) at Cheyenne ${t.bodyName} — ${t.date} [${t.hms}]`,
      ``,
      `“${t.text.slice(0, 320)}${t.text.length > 320 ? "…" : ""}”`,
      t.ordinances && t.ordinances.length ? `📜 Ordinance: ${t.ordinances.map((o) => o.slug + " (" + o.stage + ")").join(", ")}` : "",
      `🎥 Verified Primary-Source Video & Supporting Documents:`,
      shareUrl,
      `#CheyenneWY #TheRealWindyCity #PublicRecord ${(t.themes || []).map((x) => "#" + x).join(" ")}`
    ].filter(Boolean).join("\n");

    const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(caption)}`;
    const modal = document.getElementById("modalLayer");
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="if(event.target===this)document.getElementById('modalLayer').innerHTML=''">
        <div class="modal-card">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;border-bottom:1px solid #1e293b;padding-bottom:12px">
            <div>
              <div class="kicker">Facebook Civic Video &amp; Speaker Clip Studio</div>
              <h3 style="margin:4px 0 0">${esc(t.speakerName)} · ${esc(t.date)} (${Math.round(t.durationSec)}s clip)</h3>
            </div>
            <button class="btn" onclick="document.getElementById('modalLayer').innerHTML=''">✕ Close</button>
          </div>
          <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
            ${t.directMp4Url ? `<a class="btn btn-emerald" href="${esc(t.directMp4Url)}" download target="_blank" rel="noreferrer">⬇ Download Standalone Clip (.MP4)</a>` : ""}
            <button class="btn btn-amber" onclick="downloadSpeakerZip('${esc(t.speakerSlug)}')">📦 Download Speaker's Full Video Pack (.ZIP)</button>
            ${t.speakerZipUrl ? `<a class="btn" href="${esc(t.speakerZipUrl)}" target="_blank" rel="noreferrer">⬇ GitHub Release Speaker .ZIP</a>` : ""}
          </div>
          <div style="margin-top:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;color:#94a3b8">
              <span>Editable Ready-to-Paste Facebook Caption:</span>
              <button class="btn btn-sky" onclick="navigator.clipboard.writeText(document.getElementById('fbCapBox').value);this.textContent='✓ Copied!'">📋 Copy Post Text</button>
            </div>
            <textarea id="fbCapBox" rows="8" class="input" style="width:100%;font-family:var(--mono)">${esc(caption)}</textarea>
          </div>
          <div style="margin-top:14px;display:flex;justify-content:flex-end">
            <a class="btn btn-fb" href="${esc(fbHref)}" target="_blank" rel="noreferrer" onclick="navigator.clipboard.writeText(document.getElementById('fbCapBox').value).catch(()=>{})">📘 Post / Share on Facebook ↗</a>
          </div>
        </div>
      </div>`;
  };

  async function ensureSeasonLoaded(season) {
    if (DB.seasonCache.has(season)) return DB.seasonCache.get(season);
    const r = await fetch(`./data/seasons/${season}.json`);
    const j = await r.json();
    DB.seasonCache.set(season, j);
    return j;
  }

  async function ensureDocsLoaded() {
    if (DB.docs) return DB.docs;
    const r = await fetch(`./data/documents_compact.json`);
    DB.docs = await r.json();
    return DB.docs;
  }

  function renderTurnCard(t) {
    const emo = EMOTIONS[t.emotion] || EMOTIONS.technical;
    const vidId = "turnVid_" + t.id;
    return `
      <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
            <a href="#speakers:${esc(t.speakerSlug)}" onclick="openSpeaker('${esc(t.speakerSlug)}');return false;" style="font-weight:900;color:#fff">🎙️ ${esc(t.speakerName)}</a>
            <span class="tag ${emo.cls}">${emo.icon} ${esc(t.emotion)} · ${t.impactScore}</span>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px;font-family:var(--mono)">
            <a href="#ep:${esc(t.meetingSlug)}" onclick="openEpisode('${esc(t.meetingSlug)}');return false;" style="color:var(--sky)">${esc(t.date)} · ${esc(t.bodyName)}</a> · <span style="color:var(--amber)">${esc(t.hms)} (${Math.round(t.durationSec)}s)</span>
          </div>
          <div id="${vidId}" style="margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid #1e293b;background:#000">
            <button onclick="mountTurnVideo(${t.id}, '${vidId}')" style="width:100%;height:140px;background:linear-gradient(135deg,#0f172a,#020617);border:0;color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
              <span style="width:42px;height:42px;border-radius:999px;background:var(--amber);color:#000;display:grid;place-items:center;font-weight:900;font-size:16px">▶</span>
              <span style="font-size:12px;font-weight:800">Play ${Math.round(t.durationSec)}s Speaker Turn (${esc(t.hms)})</span>
            </button>
          </div>
          <p style="font-size:12px;line-height:1.5;color:#e2e8f0;margin:10px 0">“${esc(t.text.slice(0, 260))}${t.text.length > 260 ? "…" : ""}”</p>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;border-top:1px solid #1e293b;padding-top:9px;font-size:11px">
          <div>${(t.themes || []).map((th) => `<span class="tag" style="background:#1e293b;margin-right:3px">#${esc(th)}</span>`).join("")}</div>
          <div style="display:flex;gap:5px">
            <button class="btn" style="padding:4px 9px;font-size:11px" onclick="downloadSpeakerZip('${esc(t.speakerSlug)}')">📦 .ZIP</button>
            <button class="btn btn-fb" style="padding:4px 10px;font-size:11px" onclick="openFbModal(${t.id})">📘 Post to FB</button>
          </div>
        </div>
      </div>`;
  }

  window.mountTurnVideo = function (turnId, containerId) {
    const t = DB.turnById.get(Number(turnId));
    const el = document.getElementById(containerId);
    if (!t || !el) return;
    if (t.directMp4Url) {
      const src = t.directMp4Url.includes("#t=") ? t.directMp4Url : `${t.directMp4Url}#t=${t.startSec},${t.endSec}`;
      el.innerHTML = `<video src="${esc(src)}" controls autoplay style="width:100%;height:195px;background:#000"></video>`;
    } else if (t.youtubeId) {
      el.innerHTML = `<iframe src="https://www.youtube.com/embed/${esc(t.youtubeId)}?start=${Math.floor(t.startSec)}&end=${Math.ceil(t.endSec)}&autoplay=1" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:195px;border:0"></iframe>`;
    } else if (t.embedUrl) {
      el.innerHTML = `<iframe src="${esc(t.embedUrl)}" allowfullscreen style="width:100%;height:195px;border:0"></iframe>`;
    } else {
      el.innerHTML = `<div style="padding:18px;font-size:12px;color:#94a3b8;text-align:center">Verbatim transcript verified; open parent episode for full broadcast stream.</div>`;
    }
  };

  function epCardHtml(m) {
    return `
      <div class="ep-card" onclick="openEpisode('${esc(m.slug)}')">
        <div>
          <div style="display:flex;justify-content:space-between;gap:6px;font-size:10px;font-family:var(--mono);color:var(--amber)">
            <span>S${m.season}E${String(m.episodeNo).padStart(2, "0")} · ${esc(m.bodyName)}</span>
            <span>${esc(m.date)}</span>
          </div>
          <div style="font-weight:900;font-size:14.5px;margin-top:7px;line-height:1.25">${esc(m.title)}</div>
          <p style="font-size:11.5px;color:#94a3b8;margin:7px 0;line-height:1.4">${esc((m.logline || "").slice(0, 120))}…</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:10px;font-family:var(--mono);color:#cbd5e1;border-top:1px solid #1e293b;padding-top:8px">
          <span>📋 ${m.itemCount} items</span>
          <span>📄 ${m.docCount} PDFs</span>
          ${m.turnCount ? `<span style="color:var(--amber)">🎙️ ${m.turnCount} clips</span>` : ""}
        </div>
      </div>`;
  }

  function renderHome() {
    const feat = DB.episodes.find((e) => e.featured) || DB.episodes[0];
    const council26 = DB.episodes.filter((e) => e.body === "council" && e.season === 2026).slice(0, 12);
    const psc26 = DB.episodes.filter((e) => e.body === "psc" && e.season === 2026).slice(0, 10);
    const topTurns = [...DB.turns].sort((a, b) => b.impactScore - a.impactScore).slice(0, 6);
    const topOrds = DB.ordinances.slice(0, 8);

    document.getElementById("appRoot").innerHTML = `
      <section class="hero-box">
        <div>
          <div class="kicker">● LIVE STREAMING + PALANTIR GOTHAM/FOUNDRY VAULT (2008–2026)</div>
          <h1 class="hero-h1">${esc(feat.title)}</h1>
          <div style="font-size:14px;color:#e2e8f0">${esc(feat.bodyName)} · ${esc(feat.date)} · Season ${feat.season}, Episode ${feat.episodeNo}</div>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.55;max-width:660px">${esc(feat.logline)}</p>
          <div class="btn-row">
            <button class="btn btn-amber" onclick="openEpisode('${esc(feat.slug)}')">▶ Watch Episode (19 Lenses)</button>
            <button class="btn" onclick="playThemeSong()">🎵 Play Theme Song</button>
            <button class="btn btn-fb" onclick="navTo('speakers')">🎙️ Speaker Videos &amp; FB Studio (2,483)</button>
            <button class="btn btn-sky" onclick="navTo('foundry')">🏛️ Palantir Foundry PDFs (6,371)</button>
            <button class="btn btn-rose" onclick="navTo('provenance')">🎥 Provenance Films (14)</button>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-big">1,615</div><div class="stat-lbl">Complete Episodes (2008–2026) · 0 Empty</div></div>
          <div class="stat-card"><div class="stat-big">2,483</div><div class="stat-lbl">&le;3-Min Speaker Video Turns (246 Speakers)</div></div>
          <div class="stat-card"><div class="stat-big">6,371</div><div class="stat-lbl">Palantir Foundry Agendas &amp; Supporting PDFs</div></div>
          <div class="stat-card"><div class="stat-big">1,081</div><div class="stat-lbl">SHA-1 AI-Record-OCR Scanned Packets</div></div>
          <div class="stat-card"><div class="stat-big">275</div><div class="stat-lbl">Multi-Reading Ordinance Arcs (1st→Final)</div></div>
          <div class="stat-card"><div class="stat-big">14 Films</div><div class="stat-lbl">Screen-Recorded Manual Click Provenance</div></div>
        </div>
      </section>

      <div class="section-head">
        <h2>🎙️ High-Impact Speaker Video Turns (&le;3 Min)</h2>
        <span class="sub">Filter by speaker, date, ordinance, theme or emotion — download .ZIP or post to Facebook</span>
        <button class="more" onclick="navTo('speakers')">Open Full Speaker Vault →</button>
      </div>
      <div class="grid-3">${topTurns.map(renderTurnCard).join("")}</div>

      <div class="section-head">
        <h2>📜 Ordinance Arcs: First Reading → Final Enactment</h2>
        <span class="sub">Play ordinances chronologically across readings with all speaker testimony &amp; PDFs</span>
        <button class="more" onclick="navTo('ordinances')">See All 275 Ordinances →</button>
      </div>
      <div class="h-scroll">
        ${topOrds.map((o) => `
          <div class="ep-card" onclick="openOrdinance('${esc(o.slug)}')">
            <span class="tag tag-violet">${esc(o.kind)} · ${o.readings.length} readings</span>
            <div style="font-weight:800;font-size:13.5px;margin:10px 0;line-height:1.35">${esc(o.title.slice(0, 120))}</div>
            <div style="font-size:11px;color:var(--amber);font-family:var(--mono)">▶ ${esc(o.firstDate)} → ${esc(o.lastDate)}</div>
          </div>`).join("")}
      </div>

      <div class="section-head">
        <h2>Season 2026 · City Council</h2>
        <span class="sub">Newest through Nov 2026</span>
        <button class="more" onclick="navTo('episodes')">Browse All 1,615 Episodes →</button>
      </div>
      <div class="h-scroll">${council26.map(epCardHtml).join("")}</div>

      <div class="section-head">
        <h2>Public Services &amp; Standing Committees</h2>
        <span class="sub">Where ordinances &amp; zoning hearings are debated between readings</span>
      </div>
      <div class="h-scroll">${psc26.map(epCardHtml).join("")}</div>
    `;
  }

  function renderEpisodesList() {
    const seasons = [...new Set(DB.episodes.map((e) => e.season))].sort((a, b) => b - a);
    const bodies = [...new Set(DB.episodes.map((e) => e.body))];
    const filtered = DB.episodes.filter((e) => {
      if (STATE.epFilterBody && e.body !== STATE.epFilterBody) return false;
      if (STATE.epFilterSeason && String(e.season) !== String(STATE.epFilterSeason)) return false;
      if (STATE.epFilterQ && !`${e.title} ${e.logline} ${e.date} ${e.bodyName}`.toLowerCase().includes(STATE.epFilterQ.toLowerCase())) return false;
      return true;
    });

    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker">SEASON GUIDE · ZERO MISSING MEETINGS (2008–2026)</div>
        <h1 style="margin:6px 0 12px;font-size:26px">All ${DB.episodes.length.toLocaleString()} Cheyenne Government Episodes</h1>
        <div class="toolbar">
          <input class="input" style="width:280px" placeholder="Search title, topic, date…" value="${esc(STATE.epFilterQ)}" oninput="STATE.epFilterQ=this.value;renderEpisodesList()" />
          <select class="input" onchange="STATE.epFilterSeason=this.value;renderEpisodesList()">
            <option value="">All 19 Seasons (2008–2026)</option>
            ${seasons.map((s) => `<option value="${s}" ${String(STATE.epFilterSeason) === String(s) ? "selected" : ""}>Season ${s}</option>`).join("")}
          </select>
          <select class="input" onchange="STATE.epFilterBody=this.value;renderEpisodesList()">
            <option value="">All 10 Municipal Bodies</option>
            ${bodies.map((b) => `<option value="${esc(b)}" ${STATE.epFilterBody === b ? "selected" : ""}>${esc(b.toUpperCase())}</option>`).join("")}
          </select>
          <span style="font-family:var(--mono);font-size:12px;color:var(--amber)">Showing ${Math.min(90, filtered.length)} of ${filtered.length} matching episodes</span>
        </div>
      </div>
      <div class="grid-3">${filtered.slice(0, 90).map(epCardHtml).join("")}</div>
    `;
  }

  function renderLensHtml(lensKey, ep, detail) {
    const items = detail.items || [];
    const docs = detail.docs || [];
    const votes = detail.votes || [];
    const briefs = detail.briefs || [];
    const turns = detail.turns || [];

    if (lensKey === "foundry") {
      const sel = docs.find((d) => d.id === STATE.selectedDocId) || docs[0];
      return `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding:10px 12px;background:#091428;border:1px solid rgba(56,189,248,0.35);border-radius:10px;font-family:var(--mono);font-size:11px">
            <span><b style="color:var(--sky)">FOUNDRY // EPISODE PACKET VAULT</b> · OBJECTS=${docs.length} · OCR=${docs.filter((d) => d.ocr).length}</span>
            <button class="btn btn-sky" style="padding:5px 10px;font-size:11px" onclick="navTo('foundry')">Global Vault (6,371 PDFs) ↗</button>
          </div>
          <div class="foundry-shell">
            <div style="max-height:520px;overflow-y:auto;border:1px solid #1e293b;border-radius:10px;background:#050a14">
              ${docs.map((d) => `
                <div onclick="STATE.selectedDocId=${d.id};rerenderEpisode()" style="padding:10px;border-bottom:1px solid #1e293b;cursor:pointer;background:${sel && sel.id === d.id ? "rgba(56,189,248,0.16)" : "transparent"}">
                  <div style="font-family:var(--mono);font-size:10px;color:var(--sky)">${esc(d.role.toUpperCase())} ${d.ocr ? "· 🔬SHA1-OCR" : ""}</div>
                  <div style="font-size:12px;font-weight:700;margin-top:3px">${esc(d.title)}</div>
                  ${d.sha1 ? `<div style="font-family:var(--mono);font-size:9.5px;color:var(--emerald);margin-top:2px">SHA1: ${esc(d.sha1.slice(0, 16))}…</div>` : ""}
                </div>`).join("")}
            </div>
            <div style="border:1px solid #1e293b;border-radius:10px;background:#050a14;padding:12px">
              ${sel ? `
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px">
                  <div>
                    <div style="font-weight:800;font-size:13px">${esc(sel.title)}</div>
                    <div style="font-family:var(--mono);font-size:10px;color:#94a3b8">SHA1=${esc(sel.sha1 || "WAYBACK")}</div>
                  </div>
                  <div style="display:flex;gap:6px">
                    ${sel.ocr && sel.sha1 ? `<button class="btn btn-emerald" style="padding:5px 10px;font-size:11px" onclick="loadLiveOcr('${esc(sel.sha1)}')">🔬 Fetch Live SHA-1 OCR</button>` : ""}
                    ${sel.url ? `<a class="btn btn-amber" style="padding:5px 10px;font-size:11px" href="${esc(sel.url)}" target="_blank" rel="noreferrer">Open Raw PDF ↗</a>` : ""}
                  </div>
                </div>
                <div id="foundryDocPane">
                  ${sel.url && sel.url.toLowerCase().includes(".pdf")
                    ? `<iframe src="https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(sel.url)}" style="width:100%;height:430px;border:0;border-radius:8px;background:#fff"></iframe>`
                    : `<pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;max-height:430px;overflow:auto;background:#02050b;padding:12px;border-radius:8px">${esc(sel.bodySnippet || "Open Raw Link above to view full official portal document.")}</pre>`}
                </div>
              ` : ""}
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="border:1px solid rgba(244,63,94,0.35);border-radius:10px;padding:10px;background:#050a14">
                <div style="font-family:var(--mono);font-size:10px;color:#fda4af;font-weight:800;margin-bottom:6px">🎥 MANUAL-CLICK PROVENANCE CUE</div>
                <video src="./provenance/clips/clip-03-supporting-documents.mp4" controls preload="metadata" style="width:100%;border-radius:6px;background:#000"></video>
              </div>
              <div style="border:1px solid #1e293b;border-radius:10px;padding:10px;background:#050a14;font-family:var(--mono);font-size:10.5px">
                <div style="color:var(--emerald);font-weight:800;margin-bottom:6px">FOUNDRY LINEAGE DAG</div>
                <div>01. cheyennecity.org / Granicus</div>
                <div>02. cheyenne-archives-* (SHA-1)</div>
                <div>03. ai-record-ocr/{sha1}.json</div>
                <div>04. PostgreSQL 17 + Pages Shards</div>
              </div>
            </div>
          </div>
        </div>`;
    }

    if (lensKey === "gotham") {
      const nodes = [
        ...items.filter((i) => i.kind !== "procedural").slice(0, 6).map((i, idx) => ({ lbl: `Item ${i.itemNo}: ${i.title.slice(0, 26)}…`, c: "#38bdf8", ang: idx * 0.55 })),
        ...docs.slice(0, 5).map((d, idx) => ({ lbl: `PDF: ${d.title.slice(0, 22)}…`, c: "#10b981", ang: 3.2 + idx * 0.5 })),
        ...turns.slice(0, 4).map((t, idx) => ({ lbl: `🎙️ ${t.speakerName}`, c: "#f43f5e", ang: 5.2 + idx * 0.4 }))
      ];
      return `
        <div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--emerald);margin-bottom:10px"><b>GOTHAM // TACTICAL ENTITY-DOCUMENT LINK GRAPH</b> · NODES=${nodes.length + 1}</div>
          <svg viewBox="0 0 820 440" style="width:100%;height:430px;background:#040812;border:1px solid #1e293b;border-radius:12px">
            ${nodes.map((n, idx) => {
              const x = Math.round(410 + Math.cos(n.ang) * (idx % 2 ? 155 : 215));
              const y = Math.round(220 + Math.sin(n.ang) * 165);
              return `<line x1="410" y1="220" x2="${x}" y2="${y}" stroke="#1e293b" stroke-width="1.5" />
                      <circle cx="${x}" cy="${y}" r="11" fill="#091224" stroke="${n.c}" stroke-width="2.5" />
                      <text x="${x}" y="${y + 23}" text-anchor="middle" fill="#e2e8f0" font-size="10" font-family="monospace">${esc(n.lbl)}</text>`;
            }).join("")}
            <circle cx="410" cy="220" r="24" fill="#091224" stroke="#fbbf24" stroke-width="3.5" />
            <text x="410" y="258" text-anchor="middle" fill="#fbbf24" font-size="11" font-weight="bold" font-family="monospace">${esc(ep.date)} HUB</text>
          </svg>
        </div>`;
    }

    if (lensKey === "speakers") {
      return turns.length
        ? `<div class="grid-2">${turns.map(renderTurnCard).join("")}</div>`
        : `<div class="panel">No individual speaker clips extracted on this specific sitting; <a href="#speakers" onclick="navTo('speakers');return false;" style="color:var(--amber);text-decoration:underline">browse all 2,483 historical Cheyenne speaker turns →</a></div>`;
    }

    if (lensKey === "provenance") {
      return renderProvenanceInner();
    }

    if (lensKey === "votes") {
      return `<div style="display:grid;gap:10px">${votes.length ? votes.map((v) => `
        <div class="panel">
          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px">
            <span style="color:${v.result === "failed" ? "var(--rose)" : "var(--emerald)"};font-weight:800">${esc(v.result.toUpperCase())} ${v.unanimous ? "(UNANIMOUS)" : ""}</span>
            ${v.noNames && v.noNames.length ? `<span style="color:#fda4af">NO: ${esc(v.noNames.join(", "))}</span>` : ""}
          </div>
          <p style="font-size:12.5px;margin:6px 0 0">${esc(v.excerpt)}</p>
        </div>`).join("") : `<div class="panel">Committee / non-roll-call session — see Agenda &amp; Foundry PDFs.</div>`}</div>`;
    }

    if (lensKey === "money") {
      const mItems = items.filter((i) => i.amountUsd).sort((a, b) => b.amountUsd - a.amountUsd);
      return `<div style="display:grid;gap:8px">${mItems.length ? mItems.map((i) => `
        <div class="panel" style="display:flex;justify-content:space-between;gap:12px;align-items:center">
          <div><div style="font-size:11px;color:var(--muted)">Item ${esc(i.itemNo)} · ${esc(i.sponsor || "")}</div><div style="font-weight:700;font-size:13px">${esc(i.title)}</div></div>
          <div style="font-family:var(--mono);font-size:18px;font-weight:900;color:var(--emerald)">${money(i.amountUsd)}</div>
        </div>`).join("") : `<div class="panel">No explicit dollar ceilings listed in item titles on this docket.</div>`}</div>`;
    }

    if (lensKey === "transcript") {
      const minDoc = docs.find((d) => d.role === "minutes") || docs[0];
      return `<pre style="white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.55;background:#040811;padding:16px;border-radius:12px">${esc((minDoc && minDoc.bodySnippet) || ep.logline)}</pre>`;
    }

    // Default rich structured view for Story, Tabloid, Callsheet, Legal, Factcheck, Analytics, Script, Cast, Map, History, Jargon, Evidence
    return `
      <div style="display:grid;gap:12px">
        <div class="panel">
          <div class="kicker">${esc(lensKey.toUpperCase())} LENS · ${esc(ep.date)} · ${esc(ep.bodyName)}</div>
          <h3 style="margin:6px 0">${esc(ep.title)}</h3>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.55">${esc(ep.logline)}</p>
        </div>
        <div style="display:grid;gap:8px">
          ${items.slice(0, 25).map((it) => `
            <div class="panel" style="padding:11px 14px">
              <div style="display:flex;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:10.5px;color:var(--sky)">
                <span>ITEM ${esc(it.itemNo)} · ${esc((it.kind || "").toUpperCase())} ${it.reading ? "(" + esc(it.reading) + " reading)" : ""}</span>
                ${it.amountUsd ? `<span style="color:var(--emerald)">${money(it.amountUsd)}</span>` : ""}
              </div>
              <div style="font-size:12.5px;font-weight:700;margin-top:4px">${esc(it.title)}</div>
              ${it.action ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px">Action: ${esc(it.action)} ${it.sponsor ? "· " + esc(it.sponsor) : ""}</div>` : ""}
            </div>`).join("")}
        </div>
        ${briefs.length ? `<div class="panel"><div class="kicker">DETERMINISTIC PACKET BRIEFS (${briefs.length})</div>${briefs.slice(0, 6).map((b) => `<div style="margin-top:8px;font-size:12px"><b>Item ${esc(b.itemNo)}:</b> ${esc(b.title)}</div>`).join("")}</div>` : ""}
      </div>`;
  }

  window.loadLiveOcr = async function (sha1) {
    const pane = document.getElementById("foundryDocPane");
    if (!pane) return;
    pane.innerHTML = `<div class="loading-shell">Fetching live AI-Record-OCR stream (${esc(sha1.slice(0, 12))}…)…</div>`;
    try {
      const r = await fetch(`https://raw.githubusercontent.com/therealwindycity/TheReelWindyCity/main/ai-record-ocr/${sha1}.json`);
      const j = await r.json();
      const pages = Object.entries(j).sort((a, b) => Number(a[0]) - Number(b[0]));
      pane.innerHTML = `<div style="max-height:430px;overflow:auto;display:grid;gap:10px">${pages.map(([pg, txt]) => `
        <div style="background:#02050b;border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px">
          <div style="font-family:var(--mono);font-size:10px;color:var(--emerald);font-weight:800">PAGE ${esc(pg)} · SHA-1 VERIFIED OCR</div>
          <pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;margin:6px 0 0">${esc(txt)}</pre>
        </div>`).join("")}</div>`;
    } catch (e) {
      pane.innerHTML = `<div class="panel">Unable to reach raw OCR endpoint: ${esc(e)}</div>`;
    }
  };

  window.openEpisode = async function (slug) {
    STATE.view = "episode";
    STATE.epSlug = slug;
    window.location.hash = "ep:" + slug;
    updateNavButtons();
    const ep = DB.epBySlug.get(slug);
    if (!ep) return renderHome();
    document.getElementById("appRoot").innerHTML = `<div class="loading-shell">Loading Season ${ep.season} ontology shard for ${esc(ep.title)}…</div>`;
    await ensureSeasonLoaded(ep.season);
    rerenderEpisode();
  };

  window.rerenderEpisode = function () {
    const ep = DB.epBySlug.get(STATE.epSlug);
    if (!ep) return;
    const seasonData = DB.seasonCache.get(ep.season) || {};
    const detail = seasonData[ep.slug] || { items: [], docs: [], votes: [], briefs: [], turns: [] };

    const videoEmbed = ep.mp4Url
      ? `<video src="${esc(ep.mp4Url)}" controls preload="metadata" style="width:100%;max-height:360px;border-radius:14px;background:#000"></video>`
      : ep.videoUrl && ep.videoUrl.includes("archive.org/details/")
      ? `<iframe src="${esc(ep.videoUrl.replace("/details/", "/embed/"))}" allowfullscreen style="width:100%;height:340px;border:0;border-radius:14px;background:#000"></iframe>`
      : "";

    document.getElementById("appRoot").innerHTML = `
      <div style="margin-bottom:12px"><button class="btn" onclick="navTo('episodes')">← All 1,615 Episodes</button></div>
      <div class="panel" style="margin-bottom:16px">
        <div style="display:grid;gap:18px;grid-template-columns:${videoEmbed ? "1.2fr 1fr" : "1fr"}">
          <div>
            <div class="kicker">S${ep.season}E${String(ep.episodeNo).padStart(2, "0")} · ${esc(ep.bodyName)} · ${esc(ep.date)}</div>
            <h1 style="margin:8px 0;font-size:28px;line-height:1.1">${esc(ep.title)}</h1>
            <p style="font-size:13px;color:#cbd5e1;line-height:1.55">${esc(ep.logline)}</p>
            <div class="btn-row">
              <button class="btn" onclick="playThemeSong()">🎵 Play Main Title Theme</button>
              ${ep.agendaUrl ? `<a class="btn btn-sky" href="${esc(ep.agendaUrl)}" target="_blank" rel="noreferrer">📄 Official Agenda ↗</a>` : ""}
              ${ep.minutesUrl ? `<a class="btn" href="${esc(ep.minutesUrl)}" target="_blank" rel="noreferrer">📜 Official Minutes ↗</a>` : ""}
              ${ep.videoUrl ? `<a class="btn btn-amber" href="${esc(ep.videoUrl)}" target="_blank" rel="noreferrer">🎞️ Source Broadcast ↗</a>` : ""}
            </div>
          </div>
          ${videoEmbed ? `<div>${videoEmbed}</div>` : ""}
        </div>
      </div>

      <div class="toolbar" style="justify-content:space-between">
        <div style="font-weight:900;font-size:18px">Same Verified Record · 19 Synchronized Lenses</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="chip ${STATE.epMode === "swipe" ? "active" : ""}" onclick="STATE.epMode='swipe';rerenderEpisode()">↔ Single / Swipe</button>
          <button class="chip ${STATE.epMode === "split" ? "active" : ""}" onclick="STATE.epMode='split';rerenderEpisode()">◫ Side-by-Side Split</button>
          <button class="chip ${STATE.epMode === "mosaic" ? "active" : ""}" onclick="STATE.epMode='mosaic';rerenderEpisode()">▦ All 19 Mosaic</button>
          <button class="chip" onclick="spawnFloat('${esc(STATE.epLens)}')">⧉ Float Window</button>
        </div>
      </div>

      ${STATE.epMode === "swipe" ? `
        <div class="h-scroll" style="margin-bottom:12px">
          ${LENSES.map((l) => `
            <button class="chip ${STATE.epLens === l.key ? "active" : ""}" title="${esc(l.blurb)}" onclick="STATE.epLens='${l.key}';rerenderEpisode()">
              ${l.icon} ${esc(l.name)}
            </button>`).join("")}
        </div>
        <div class="lens-stage">${renderLensHtml(STATE.epLens, ep, detail)}</div>
      ` : STATE.epMode === "split" ? `
        <div class="split-stage">
          <div class="lens-stage">
            <div style="margin-bottom:10px">
              <select class="input" onchange="STATE.splitLeft=this.value;rerenderEpisode()">
                ${LENSES.map((l) => `<option value="${l.key}" ${STATE.splitLeft === l.key ? "selected" : ""}>${l.icon} ${esc(l.name)}</option>`).join("")}
              </select>
            </div>
            ${renderLensHtml(STATE.splitLeft, ep, detail)}
          </div>
          <div class="lens-stage">
            <div style="margin-bottom:10px">
              <select class="input" onchange="STATE.splitRight=this.value;rerenderEpisode()">
                ${LENSES.map((l) => `<option value="${l.key}" ${STATE.splitRight === l.key ? "selected" : ""}>${l.icon} ${esc(l.name)}</option>`).join("")}
              </select>
            </div>
            ${renderLensHtml(STATE.splitRight, ep, detail)}
          </div>
        </div>
      ` : `
        <div class="grid-3">
          ${LENSES.map((l) => `
            <div class="panel" style="border-top:3px solid ${l.accent}">
              <div style="font-weight:900;font-size:15px">${l.icon} ${esc(l.name)}</div>
              <p style="font-size:12px;color:#cbd5e1;margin:8px 0 14px">${esc(l.blurb)}</p>
              <div style="display:flex;gap:6px">
                <button class="btn btn-amber" style="padding:6px 12px" onclick="STATE.epMode='swipe';STATE.epLens='${l.key}';rerenderEpisode()">Open Lens</button>
                <button class="btn" style="padding:6px 12px" onclick="spawnFloat('${l.key}')">⧉ Float</button>
              </div>
            </div>`).join("")}
        </div>
      `}
    `;
  };

  window.spawnFloat = function (lensKey) {
    const ep = DB.epBySlug.get(STATE.epSlug);
    if (!ep) return;
    const detail = (DB.seasonCache.get(ep.season) || {})[ep.slug] || {};
    const l = LENSES.find((x) => x.key === lensKey) || LENSES[0];
    const win = document.createElement("div");
    win.className = "float-win";
    win.style.left = 60 + (STATE.floats.length * 32) + "px";
    win.style.top = 90 + (STATE.floats.length * 28) + "px";
    win.innerHTML = `
      <div class="float-bar" style="background:${l.accent}33;border-bottom:2px solid ${l.accent}">
        <span>${l.icon} ${esc(l.name)} · ${esc(ep.date)}</span>
        <button class="btn" style="margin-left:auto;padding:2px 8px" onclick="this.closest('.float-win').remove()">✕</button>
      </div>
      <div class="float-body">${renderLensHtml(lensKey, ep, detail)}</div>
    `;
    const bar = win.querySelector(".float-bar");
    let dx = 0, dy = 0, dragging = false;
    bar.addEventListener("pointerdown", (e) => {
      dragging = true;
      dx = e.clientX - win.offsetLeft;
      dy = e.clientY - win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      win.style.left = Math.max(0, e.clientX - dx) + "px";
      win.style.top = Math.max(48, e.clientY - dy) + "px";
    });
    bar.addEventListener("pointerup", () => { dragging = false; });
    document.getElementById("floatLayer").appendChild(win);
    STATE.floats.push(win);
  };

  window.openSpeaker = function (slug) {
    STATE.view = "speakers";
    STATE.spkAxis = "speaker";
    STATE.spkSlug = slug;
    window.location.hash = "speakers:" + slug;
    updateNavButtons();
    renderSpeakersVault();
  };

  window.renderSpeakersVault = function () {
    const activeSpk = STATE.spkSlug ? DB.speakerBySlug.get(STATE.spkSlug) : null;
    const datesMap = new Map();
    for (const t of DB.turns) {
      if (!datesMap.has(t.date)) datesMap.set(t.date, { date: t.date, bodyName: t.bodyName, count: 0 });
      datesMap.get(t.date).count++;
    }
    const datesList = [...datesMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);

    let filtered = DB.turns.filter((t) => {
      if (STATE.spkSlug && t.speakerSlug !== STATE.spkSlug) return false;
      if (STATE.spkDate && t.date !== STATE.spkDate) return false;
      if (STATE.spkTheme && !(t.themes || []).includes(STATE.spkTheme)) return false;
      if (STATE.spkEmotion && t.emotion !== STATE.spkEmotion) return false;
      if (STATE.spkOrd && !(t.ordinances || []).some((o) => o.slug === STATE.spkOrd)) return false;
      if (STATE.spkQ && !`${t.speakerName} ${t.text} ${t.date}`.toLowerCase().includes(STATE.spkQ.toLowerCase())) return false;
      return true;
    });

    if (STATE.spkSort === "newest") filtered.sort((a, b) => b.date.localeCompare(a.date) || a.startSec - b.startSec);
    else if (STATE.spkSort === "oldest") filtered.sort((a, b) => a.date.localeCompare(b.date) || a.startSec - b.startSec);
    else filtered.sort((a, b) => b.impactScore - a.impactScore);

    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker">🎙️ HISTORICAL SPEAKER-TURN VIDEO DATABASE &amp; FACEBOOK CLIP STUDIO</div>
        <h1 style="margin:6px 0 8px;font-size:28px">2,483 Individual &le;3-Min Speaker Video Turns · 246 Cheyenne Speakers</h1>
        <div class="toolbar">
          ${[
            ["speaker", "👤 By Speaker (All Meetings)"],
            ["date", "📅 By Date (All Speakers)"],
            ["ordinance", "📜 By Ordinance (All Readings)"],
            ["theme", "🏷️ By Civic Theme"],
            ["emotion", "🔥 By Emotional Impact"]
          ].map(([k, lbl]) => `<button class="chip ${STATE.spkAxis === k ? "active" : ""}" onclick="STATE.spkAxis='${k}';renderSpeakersVault()">${lbl}</button>`).join("")}
          <input class="input" style="margin-left:auto;width:240px" placeholder="Search verbatim speech or speaker…" value="${esc(STATE.spkQ)}" oninput="STATE.spkQ=this.value;renderSpeakersVault()" />
          ${(STATE.spkSlug || STATE.spkDate || STATE.spkOrd || STATE.spkTheme || STATE.spkEmotion || STATE.spkQ)
            ? `<button class="btn btn-rose" style="padding:5px 11px" onclick="STATE.spkSlug='';STATE.spkDate='';STATE.spkOrd='';STATE.spkTheme='';STATE.spkEmotion='';STATE.spkQ='';renderSpeakersVault()">✕ Reset Filters</button>` : ""}
        </div>

        <div style="background:#040811;border:1px solid #1e293b;border-radius:10px;padding:12px;max-height:190px;overflow-y:auto">
          ${STATE.spkAxis === "speaker" ? DB.speakers.slice(0, 90).map((s) => `
            <button class="chip ${STATE.spkSlug === s.slug ? "active" : ""}" style="margin:3px" onclick="STATE.spkSlug=(STATE.spkSlug==='${esc(s.slug)}'?'':'${esc(s.slug)}');renderSpeakersVault()">
              ${esc(s.name)} (${s.turnCount})
            </button>`).join("")
          : STATE.spkAxis === "date" ? datesList.map((d) => `
            <button class="chip ${STATE.spkDate === d.date ? "active" : ""}" style="margin:3px;font-family:var(--mono)" onclick="STATE.spkDate=(STATE.spkDate==='${d.date}'?'':'${d.date}');STATE.spkSort='oldest';renderSpeakersVault()">
              ${d.date} · ${esc(d.bodyName)} (${d.count})
            </button>`).join("")
          : STATE.spkAxis === "ordinance" ? DB.ordinances.slice(0, 60).map((o) => `
            <button class="chip ${STATE.spkOrd === o.slug ? "active" : ""}" style="margin:3px" onclick="STATE.spkOrd=(STATE.spkOrd==='${esc(o.slug)}'?'':'${esc(o.slug)}');STATE.spkSort='oldest';renderSpeakersVault()">
              📜 ${esc(o.title.slice(0, 52))}…
            </button>`).join("")
          : STATE.spkAxis === "theme" ? Object.entries(THEMES).map(([k, lbl]) => `
            <button class="chip ${STATE.spkTheme === k ? "active" : ""}" style="margin:4px" onclick="STATE.spkTheme=(STATE.spkTheme==='${k}'?'':'${k}');renderSpeakersVault()">
              #${k} · ${esc(lbl)}
            </button>`).join("")
          : Object.entries(EMOTIONS).map(([k, m]) => `
            <button class="chip ${STATE.spkEmotion === k ? "active" : ""}" style="margin:4px" onclick="STATE.spkEmotion=(STATE.spkEmotion==='${k}'?'':'${k}');renderSpeakersVault()">
              ${m.icon} ${esc(m.label)}
            </button>`).join("")}
        </div>
      </div>

      ${activeSpk ? `
        <div class="panel" style="margin-bottom:16px;border-color:var(--amber)">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:center">
            <div>
              <div class="kicker">${esc(activeSpk.role)} · ${activeSpk.firstDate} → ${activeSpk.lastDate}</div>
              <h2 style="margin:4px 0">${esc(activeSpk.name)} — ${activeSpk.turnCount} Recorded Turns Across ${activeSpk.meetingCount} Meetings</h2>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-amber" onclick="downloadSpeakerZip('${esc(activeSpk.slug)}')">📦 Download All ${activeSpk.turnCount} Speaker Clips (.ZIP)</button>
              ${filtered[0] ? `<button class="btn btn-fb" onclick="openFbModal(${filtered[0].id})">📘 Post Speaker Video to Facebook</button>` : ""}
            </div>
          </div>
          ${activeSpk.compilationReels && activeSpk.compilationReels.length ? `
            <div class="grid-2" style="margin-top:12px">
              ${activeSpk.compilationReels.map((r) => `
                <div style="background:#000;padding:10px;border-radius:10px;border:1px solid #1e293b">
                  <div style="font-size:12px;font-weight:800;margin-bottom:6px">${esc(r.title)}</div>
                  <video src="${esc(r.url)}" controls preload="metadata" style="width:100%;height:180px"></video>
                </div>`).join("")}
            </div>` : ""}
        </div>` : ""}

      <div class="toolbar" style="justify-content:space-between">
        <span style="font-weight:800">Showing ${Math.min(60, filtered.length)} of ${filtered.length.toLocaleString()} matching &le;3-min speaker video turns</span>
        <select class="input" onchange="STATE.spkSort=this.value;renderSpeakersVault()">
          <option value="impact" ${STATE.spkSort === "impact" ? "selected" : ""}>Sort: Highest Emotional Impact</option>
          <option value="newest" ${STATE.spkSort === "newest" ? "selected" : ""}>Sort: Newest First</option>
          <option value="oldest" ${STATE.spkSort === "oldest" ? "selected" : ""}>Sort: Chronological (First → Last)</option>
        </select>
      </div>
      <div class="grid-3">${filtered.slice(0, 60).map(renderTurnCard).join("")}</div>
    `;
  };

  window.openOrdinance = async function (slug) {
    STATE.view = "ordinance_detail";
    STATE.ordSlug = slug;
    STATE.ordStageIdx = 0;
    window.location.hash = "ord:" + slug;
    updateNavButtons();
    const ord = DB.ordBySlug.get(slug);
    if (!ord) return renderOrdinancesList();
    for (const r of ord.readings) {
      const ep = r.meeting ? DB.epBySlug.get(r.meeting) : null;
      if (ep) await ensureSeasonLoaded(ep.season);
    }
    renderOrdinanceDetail();
  };

  window.renderOrdinanceDetail = function () {
    const ord = DB.ordBySlug.get(STATE.ordSlug);
    if (!ord) return;
    const r = ord.readings[STATE.ordStageIdx] || ord.readings[0];
    const ep = r && r.meeting ? DB.epBySlug.get(r.meeting) : null;
    const detail = ep ? (DB.seasonCache.get(ep.season) || {})[ep.slug] || {} : {};
    const stageTurns = DB.turns.filter((t) => (r && r.meeting && t.meetingSlug === r.meeting) || (t.ordinances || []).some((o) => o.slug === ord.slug));

    document.getElementById("appRoot").innerHTML = `
      <div style="margin-bottom:12px"><button class="btn" onclick="navTo('ordinances')">← All 275 Multi-Reading Ordinances</button></div>
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker">📜 FIRST-TO-LAST READING SEQUENTIAL ORDINANCE PLAYER · ${esc(ord.kind)} (${esc(ord.firstDate)} → ${esc(ord.lastDate)})</div>
        <h1 style="margin:8px 0 14px;font-size:24px">${esc(ord.title)}</h1>
        <div class="grid-3">
          ${ord.readings.map((st, idx) => `
            <div onclick="STATE.ordStageIdx=${idx};renderOrdinanceDetail()" class="panel" style="cursor:pointer;border-color:${idx === STATE.ordStageIdx ? "var(--amber)" : "#1e293b"};background:${idx === STATE.ordStageIdx ? "rgba(251,191,36,0.12)" : "#050a14"}">
              <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px">
                <span class="tag tag-amber">STAGE ${idx + 1} · ${esc(st.stage)}</span>
                <span>${esc(st.date)}</span>
              </div>
              <div style="font-weight:800;margin-top:8px">${esc(st.body)}</div>
              ${st.context ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">${esc(st.context.slice(0, 100))}</div>` : ""}
            </div>`).join("")}
        </div>
      </div>

      ${ep ? `
        <div class="panel" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <h2 style="margin:0">Stage ${STATE.ordStageIdx + 1}: ${esc(ep.date)} · ${esc(ep.bodyName)}</h2>
            <button class="btn btn-sky" onclick="openEpisode('${esc(ep.slug)}')">Open Full 19-Lens Episode →</button>
          </div>
          ${ep.mp4Url ? `<video src="${esc(ep.mp4Url)}" controls preload="metadata" style="width:100%;max-height:360px;background:#000;border-radius:12px"></video>` : ""}
          <div style="margin-top:12px">
            <div class="kicker" style="margin-bottom:8px">PALANTIR FOUNDRY SUPPORTING PDFS AT THIS READING (${(detail.docs || []).length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${(detail.docs || []).slice(0, 12).map((d) => d.url ? `<a class="btn" style="font-size:11px;padding:5px 10px" href="${esc(d.url)}" target="_blank" rel="noreferrer">📄 ${esc(d.title.slice(0, 48))} ↗</a>` : "").join("")}
            </div>
          </div>
        </div>` : ""}

      <h3 style="margin:18px 0 10px">🎙️ Speaker Testimony &amp; Floor Interventions Across Readings (${stageTurns.length})</h3>
      <div class="grid-3">${stageTurns.slice(0, 24).map(renderTurnCard).join("")}</div>
    `;
  };

  function renderOrdinancesList() {
    const filtered = DB.ordinances.filter((o) => !STATE.ordQ || o.title.toLowerCase().includes(STATE.ordQ.toLowerCase()));
    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker">📜 MULTI-READING LEGISLATIVE ARCS (PILOT 1ST READING → FINALE 3RD READING)</div>
        <h1 style="margin:6px 0 12px;font-size:26px">${DB.ordinances.length} Cheyenne Ordinances Tracked Start-to-Finish</h1>
        <input class="input" style="width:340px" placeholder="Filter ordinances (Cox, Annexation, UDC, Budget…)" value="${esc(STATE.ordQ)}" oninput="STATE.ordQ=this.value;renderOrdinancesList()" />
      </div>
      <div class="grid-3">
        ${filtered.slice(0, 90).map((o) => `
          <div class="ep-card" onclick="openOrdinance('${esc(o.slug)}')">
            <div>
              <span class="tag tag-violet">${esc(o.kind)} · ${o.readings.length} stages</span>
              <div style="font-weight:800;font-size:14px;margin:10px 0;line-height:1.35">${esc(o.title)}</div>
            </div>
            <div style="font-family:var(--mono);font-size:11px;color:var(--amber)">▶ Play 1st (${esc(o.firstDate)}) → Final (${esc(o.lastDate)})</div>
          </div>`).join("")}
      </div>`;
  }

  async function renderGlobalFoundry() {
    document.getElementById("appRoot").innerHTML = `<div class="loading-shell">Loading 6,371 Palantir Foundry Document &amp; SHA-1 OCR Objects…</div>`;
    const docs = await ensureDocsLoaded();
    const filtered = docs.filter((d) => {
      if (STATE.docRole && d.role !== STATE.docRole) return false;
      if (STATE.docOcr && !d.ocr) return false;
      if (STATE.docQ && !`${d.title} ${d.date} ${d.sha1 || ""} ${d.bodyName}`.toLowerCase().includes(STATE.docQ.toLowerCase())) return false;
      return true;
    });

    document.getElementById("appRoot").innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="kicker" style="color:var(--sky)">PALANTIR FOUNDRY // GLOBAL AGENDAS &amp; SUPPORTING DOCUMENTS VAULT</div>
        <h1 style="margin:6px 0 12px;font-size:26px">6,371 Primary PDFs &amp; 1,081 SHA-1 AI-Record-OCR Packets (2008–2026)</h1>
        <div class="toolbar">
          <input class="input" style="width:320px;font-family:var(--mono)" placeholder="Search PDF title, SHA-1 hash, date…" value="${esc(STATE.docQ)}" oninput="STATE.docQ=this.value;renderGlobalFoundry()" />
          <select class="input" onchange="STATE.docRole=this.value;renderGlobalFoundry()">
            <option value="">ROLE: ALL (6,371)</option>
            <option value="attachment" ${STATE.docRole === "attachment" ? "selected" : ""}>SUPPORTING PDFs</option>
            <option value="agenda" ${STATE.docRole === "agenda" ? "selected" : ""}>OFFICIAL AGENDAS</option>
            <option value="minutes" ${STATE.docRole === "minutes" ? "selected" : ""}>MINUTES &amp; TRANSCRIPTS</option>
          </select>
          <button class="chip ${STATE.docOcr ? "active" : ""}" onclick="STATE.docOcr=!STATE.docOcr;renderGlobalFoundry()">🔬 SHA-1 OCR Only (1,081)</button>
          <span style="font-family:var(--mono);font-size:12px;color:var(--sky)">MATCHED=${filtered.length.toLocaleString()}</span>
        </div>
      </div>
      <div class="panel" style="padding:0;overflow:hidden">
        <table class="foundry-tbl">
          <thead><tr><th>Date / Body</th><th>Role</th><th>Supporting PDF / Agenda Object</th><th>SHA-1 / OCR</th><th>Inspect</th></tr></thead>
          <tbody>
            ${filtered.slice(0, 90).map((d) => `
              <tr>
                <td style="font-family:var(--mono);white-space:nowrap"><a href="#ep:${esc(d.meetingSlug)}" onclick="openEpisode('${esc(d.meetingSlug)}');return false;" style="color:var(--sky);font-weight:800">${esc(d.date)}</a><div style="font-size:10px;color:#94a3b8">${esc(d.bodyName)}</div></td>
                <td><span class="tag tag-sky">${esc(d.role)}</span></td>
                <td><b>${esc(d.title)}</b><div style="font-size:11px;color:#94a3b8">${esc(d.episodeTitle || "")}</div></td>
                <td style="font-family:var(--mono);font-size:10.5px">${d.ocr ? `<span class="tag tag-emerald">🔬OCR</span> ` : ""}${esc(d.sha1 ? d.sha1.slice(0, 12) + "…" : "WAYBACK")}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sky" style="padding:4px 9px;font-size:11px" onclick="STATE.selectedDocId=${d.id};STATE.epLens='foundry';openEpisode('${esc(d.meetingSlug)}')">Foundry</button>
                  ${d.url ? `<a class="btn btn-amber" style="padding:4px 9px;font-size:11px" href="${esc(d.url)}" target="_blank" rel="noreferrer">PDF ↗</a>` : ""}
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderProvenanceInner() {
    const p = DB.provenance;
    if (!p) return `<div class="panel">Loading provenance catalog…</div>`;
    const curUrl = STATE.provActiveUrl || p.masterFilms[0].pagesUrl;
    const curTitle = STATE.provActiveTitle || p.masterFilms[0].title;
    const curDesc = STATE.provActiveDesc || p.masterFilms[0].description;
    const rows = p.chapters.flatMap((c) => (c.ledgerRows || []).map((r) => ({ ...r, clipUrl: c.pagesUrl, chTitle: c.title })))
      .filter((r) => !STATE.provQ || `${r.key} ${r.item} ${r.how || ""}`.toLowerCase().includes(STATE.provQ.toLowerCase()));

    return `
      <div>
        <div class="panel" style="margin-bottom:16px;border-color:rgba(244,63,94,0.4)">
          <div class="kicker" style="color:#fda4af">🎥 SCREEN-RECORDED MANUAL CLICK-PATH PROVENANCE SUITE</div>
          <h1 style="margin:6px 0">Every Public Portal &amp; Manual Browser Click Recorded on Tape</h1>
          <p style="font-size:12.5px;color:#cbd5e1">Watch the real browser screen recordings showing the literal clicks on <code>cheyennecity.org</code>, <code>cheyenne.granicus.com</code>, and public portals used to obtain every calendar, agenda packet, supporting PDF, minute, and video (${esc(p.summaryStats.manualEquivalentEstimate)} manual equivalent across ${p.summaryStats.totalFilesAudited.toLocaleString()} audited files).</p>
        </div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="panel" style="background:#000">
            <video src="${esc(curUrl)}" poster="./provenance/provenance-timelapse-poster.jpg" controls style="width:100%;aspect-ratio:16/9;border-radius:10px;background:#000"></video>
            <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-top:10px">
              <div><div style="font-weight:900;font-size:15px">${esc(curTitle)}</div><div style="font-size:12px;color:#94a3b8;margin-top:3px">${esc(curDesc)}</div></div>
              <a class="btn btn-rose" href="${esc(curUrl)}" download>⬇ MP4</a>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">
              ${p.masterFilms.map((mf) => `
                <button class="panel" style="padding:9px;text-align:left;cursor:pointer;border-color:${curUrl === mf.pagesUrl ? "var(--rose)" : "#1e293b"}" onclick="setProvVideo('${esc(mf.pagesUrl)}','${esc(mf.title)}','${esc(mf.description)}')">
                  <div style="font-family:var(--mono);font-size:10px;color:#fda4af">${mf.durationSec}s · ${mf.sizeMb}MB</div>
                  <div style="font-size:11.5px;font-weight:800;margin-top:3px">${esc(mf.title)}</div>
                </button>`).join("")}
            </div>
          </div>
          <div class="panel" style="max-height:520px;overflow-y:auto">
            <div class="kicker" style="color:var(--sky);margin-bottom:8px">11 MANUAL CLICK-PATH CHAPTER CLIPS (~15s EACH)</div>
            ${p.chapters.map((ch) => `
              <div onclick="setProvVideo('${esc(ch.pagesUrl)}','${esc(ch.title)}','${esc(ch.description)}')" style="padding:9px;border-bottom:1px solid #1e293b;cursor:pointer">
                <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;color:var(--amber)"><span>▶ ${esc(ch.title)}</span><span>${ch.durationSec}s</span></div>
                <div style="font-size:11.5px;color:#cbd5e1;margin-top:3px">${esc(ch.description)}</div>
              </div>`).join("")}
          </div>
        </div>
        <div class="panel">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div class="kicker" style="color:var(--emerald)">121-ROW MANUAL CLICK-PATH VERIFICATION LEDGER</div>
            <input class="input" style="width:260px" placeholder="Filter click paths…" value="${esc(STATE.provQ)}" oninput="STATE.provQ=this.value;navTo('provenance')" />
          </div>
          <div style="max-height:320px;overflow-y:auto">
            <table class="foundry-tbl">
              <thead><tr><th>Datum</th><th>Count</th><th>Literal Manual Click Sequence</th><th>Cue</th></tr></thead>
              <tbody>
                ${rows.slice(0, 60).map((r) => `
                  <tr>
                    <td style="font-family:var(--mono);color:var(--sky)">${esc(r.key)}</td>
                    <td style="font-family:var(--mono);color:var(--amber);font-weight:800">${esc(r.value)}</td>
                    <td>${esc(r.how || "")}</td>
                    <td><button class="btn btn-rose" style="padding:3px 8px;font-size:10.5px" onclick="setProvVideo('${esc(r.clipUrl)}','${esc(r.chTitle)}','${esc(r.how || "")}')">▶ Watch</button></td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  window.setProvVideo = function (url, title, desc) {
    STATE.provActiveUrl = url;
    STATE.provActiveTitle = title;
    STATE.provActiveDesc = desc;
    if (STATE.view === "episode") rerenderEpisode();
    else document.getElementById("appRoot").innerHTML = renderProvenanceInner();
  };

  function updateNavButtons() {
    document.querySelectorAll("#mainNav button").forEach((b) => {
      const target = b.getAttribute("data-nav");
      b.classList.toggle("active", target === STATE.view || (STATE.view === "episode" && target === "episodes") || (STATE.view === "ordinance_detail" && target === "ordinances"));
    });
  }

  window.navTo = function (view) {
    STATE.view = view;
    window.location.hash = view;
    updateNavButtons();
    if (view === "home") renderHome();
    else if (view === "episodes") renderEpisodesList();
    else if (view === "speakers") renderSpeakersVault();
    else if (view === "ordinances") renderOrdinancesList();
    else if (view === "foundry") renderGlobalFoundry();
    else if (view === "provenance") document.getElementById("appRoot").innerHTML = renderProvenanceInner();
  };

  async function boot() {
    const [eps, turns, spks, ords, prov, people] = await Promise.all([
      fetch("./data/episodes_index.json").then((r) => r.json()),
      fetch("./data/speaker_turns.json").then((r) => r.json()),
      fetch("./data/speakers_directory.json").then((r) => r.json()),
      fetch("./data/ordinances.json").then((r) => r.json()),
      fetch("./data/provenance_videos.json").then((r) => r.json()),
      fetch("./data/people.json").then((r) => r.json())
    ]);
    DB.episodes = eps;
    eps.forEach((e) => DB.epBySlug.set(e.slug, e));
    DB.turns = turns;
    turns.forEach((t) => DB.turnById.set(t.id, t));
    DB.speakers = spks;
    spks.forEach((s) => DB.speakerBySlug.set(s.slug, s));
    DB.ordinances = ords;
    ords.forEach((o) => DB.ordBySlug.set(o.slug, o));
    DB.provenance = prov;
    DB.people = people;

    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        navTo(el.getAttribute("data-nav"));
      });
    });

    const h = window.location.hash.replace(/^#/, "");
    if (h.startsWith("ep:")) return openEpisode(decodeURIComponent(h.slice(3)));
    if (h.startsWith("speakers:")) return openSpeaker(decodeURIComponent(h.slice(9)));
    if (h.startsWith("ord:")) return openOrdinance(decodeURIComponent(h.slice(4)));
    if (["episodes", "speakers", "ordinances", "foundry", "provenance"].includes(h)) return navTo(h);
    renderHome();
  }

  boot().catch((err) => {
    document.getElementById("appRoot").innerHTML = `<div class="panel">Initialization error: ${esc(err)}</div>`;
  });
})();
