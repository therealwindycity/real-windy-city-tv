(function () {
  "use strict";

  const DB = window.CIVIC_TV_DB;
  if (!DB) {
    document.body.innerHTML = "<p style='padding:32px;color:#fff'>Error: CIVIC_TV_DB failed to load.</p>";
    return;
  }

  const LENSES = [
    { id: "tv", icon: "🎬", name: "TV Episode & Cast", diet: "Broadcast Story", desc: "Cold Open, 'Previously On...' recap, Cast of Characters, 3-Act breakdown & Next Episode cliffhanger." },
    { id: "layman", icon: "☕", name: "Layman's Narrative", diet: "Plain English", desc: "Zero-jargon kitchen-table translation: what happened, why they argued, and how it hits your wallet & neighborhood." },
    { id: "tabloid", icon: "🗞️", name: "Windy City Tabloid", diet: "High-Drama Tea", desc: "Punchy Capitol Ave headlines, dais clashes, verbatim zingers, and Winners vs. Losers — 100% anchored to real timestamps." },
    { id: "legal", icon: "⚖️", name: "Legal & Statutory", diet: "Scientific / Counsel", desc: "Cheyenne Municipal Code, UDC citations, Wyoming Statutes, standard of review, constitutional & preemption exposure." },
    { id: "verbatim", icon: "📜", name: "Verbatim & Clips", diet: "Primary Evidence", desc: "Searchable timestamped transcript synced to live Archive.org video clips and per-speaker GitHub Release ZIP downloads." },
    { id: "analytics", icon: "📊", name: "Civic Analytics", diet: "Quantitative Lab", desc: "Speaking-time Gini concentration, debate heat timeline, talk-share bars, and speaker-to-speaker turn transitions." },
    { id: "map", icon: "🗺️", name: "Cheyenne Geo-Map", diet: "Spatial / Ward View", desc: "Interactive Cheyenne corridor & parcel map plotting annexations, UDC zones, plats, and infrastructure projects." },
    { id: "historical", icon: "🏛️", name: "Historical Vault", diet: "2008–2026 Precedent", desc: "Cross-year comparison showing how Cheyenne handled similar items across all 6 therealwindycity archive repos." },
    { id: "fiscal", icon: "💰", name: "Follow the Money", diet: "Taxpayer Ledger", desc: "Contract modifications, General Fund & 6th-Penny capital flows, TIF districts, and private-vs-public cost shifts." },
    { id: "ordinance_arc", icon: "🧭", name: "Ordinance Tracker", diet: "Legislative Pipeline", desc: "Tracks bills from Planning Commission -> 1st Reading -> Committee -> 2nd Reading -> 3rd Reading + citizen action guide." }
  ];

  // Parse URL params for Floating Iframe Embed Mode (?embed=1&lens=legal&item=...)
  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get("embed") === "1";
  const initialLens = params.get("lens") || "tv";
  const initialItem = params.get("item") || (DB.rich_episodes[1] ? DB.rich_episodes[1].id : DB.rich_episodes[0].id);

  const state = {
    mode: "featured", // 'featured' | 'ordinances' | 'vault'
    selectedId: initialItem,
    activeLens: LENSES.some(l => l.id === initialLens) ? initialLens : "tv",
    viewMode: "swipe", // 'swipe' | 'split2' | 'split3' | 'iframes'
    splitLenses: ["layman", "legal", "verbatim"],
    iframeLayout: "tiled", // 'tiled' | 'free'
    search: "",
    season: "ALL",
    type: "ALL",
    speaker: "ALL",
    transcriptSearch: "",
    transcriptSpeaker: "ALL",
    livePublishedState: {}, // populated async from GitHub raw state.json across the 6 repos
  };

  if (isEmbed) {
    document.body.classList.add("embed-mode");
  }

  // Index rich episodes & catalog for O(1) lookup
  const richById = {};
  DB.rich_episodes.forEach(ep => { richById[ep.id] = ep; });
  const arcById = {};
  DB.ordinance_arcs.forEach(a => { arcById[a.id] = a; });
  const catById = {};
  DB.catalog_804.forEach((c, idx) => { c._idx = idx; catById[c.id] = c; });

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDur(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${r}s`;
  }

  // Convert any Ordinance Mini-Series or any of the 804 Catalog items into a unified Episode View-Model
  function resolveActiveRecord(id) {
    if (richById[id]) return richById[id];

    if (arcById[id]) {
      const arc = arcById[id];
      const base = richById[arc.linked_primary_episode] || DB.rich_episodes[1];
      // Combine cast & transcripts across all episodes in this ordinance arc!
      const combinedCastMap = new Map();
      const combinedActs = arc.episodes_in_arc.map((step, i) => ({
        act: `EPISODE ${i + 1} OF ARC — ${step.stage} (${step.date})`,
        summary: step.note,
        jump_ep: step.ep_id
      }));
      arc.episodes_in_arc.forEach(step => {
        const ep = richById[step.ep_id];
        if (ep) {
          ep.cast.slice(0, 6).forEach(c => {
            if (!combinedCastMap.has(c.name)) combinedCastMap.set(c.name, Object.assign({}, c));
          });
        }
      });
      return Object.assign({}, base, {
        id: arc.id,
        is_ordinance_series: true,
        arc_steps: arc.episodes_in_arc,
        code: arc.code,
        date: arc.date,
        official_title: arc.ordinance_number,
        show_title: arc.show_title,
        badge: arc.badge,
        drama_score: arc.drama_score,
        meeting_type: "Ordinance Story Arc",
        acts: combinedActs,
        cast: Array.from(combinedCastMap.values()).slice(0, 12),
        layman: {
          headline: `Ordinance Mini-Series: ${arc.show_title}`,
          tldr: arc.summary + " Follow every reading from initial introduction to committee cross-examination and floor amendments.",
          wallet_impact: base.layman.wallet_impact,
          who_cares: base.layman.who_cares
        }
      });
    }

    // Historical episode from the 804-item Archive.org catalog (Seasons 1..15, 2012..2026)
    const cat = catById[id] || DB.catalog_804[0];
    const prevChron = DB.catalog_804[cat._idx + 1]; // older meeting before this one
    const nextChron = DB.catalog_804[cat._idx - 1]; // newer meeting after this one
    const livePub = state.livePublishedState[cat.id];
    const badgeParts = [`SEASON ${cat.season} (${cat.year})`];
    if (cat.premiere) badgeParts.push("🌟 SEASON PREMIERE");
    if (cat.finale) badgeParts.push("🏁 SEASON FINALE");
    if (livePub && livePub.status === "published") badgeParts.push(`✅ ${livePub.speakers} SPEAKER ZIPS LIVE`);

    return {
      id: cat.id,
      code: cat.code,
      season: cat.season,
      year: cat.year,
      date: cat.date,
      official_title: cat.title,
      show_title: `${cat.title}${cat.premiere ? " — Season Premiere" : (cat.finale ? " — Season Finale" : "")}`,
      badge: badgeParts.join(" · "),
      drama_score: 7.8,
      meeting_type: cat.type,
      duration_sec: Math.round((cat.size_mb || 250) * 11),
      stream_url: "",
      embed_url: `https://archive.org/embed/${cat.id}`,
      archive_url: `https://archive.org/details/${cat.id}`,
      github_repo: cat.repo,
      release_url: livePub && livePub.release_url ? livePub.release_url : `https://github.com/${cat.repo}/releases`,
      release_zips_count: livePub ? (livePub.speakers || 0) : 0,
      previously_on: prevChron ? [{
        ep_id: prevChron.id,
        label: `${prevChron.code} · ${prevChron.date}`,
        summary: `Preceding Cheyenne broadcast: "${prevChron.title}" (${prevChron.type}).`
      }] : [],
      next_episode: {
        headline: nextChron ? `Next Broadcast (${nextChron.code} · ${nextChron.date}): ${nextChron.title}` : "Latest Broadcast in Archive",
        cliffhanger: nextChron ? `Storylines and committee referrals advance to ${nextChron.title} on ${nextChron.date}.` : "Awaiting next Ch192 upload."
      },
      ordinances: [`Full Ch192 Archival Docket — ${cat.title} (${cat.date})`],
      acts: [
        { act: "ACT I — Call to Order, Roll Call & Agenda Adoption", summary: `${cat.type} convenes on ${cat.date} (Season ${cat.season}, Episode ${cat.ep_num}). Full archival video (${cat.size_mb} MB) preserved in Internet Archive collection cochwy.` },
        { act: "ACT II — Public Hearings, Staff Reports & Amendments", summary: `Automated GitHub Actions runner in ${cat.repo} splits every speaking turn into per-speaker MP4 ZIP archives (Newest -> Oldest).` },
        { act: "ACT III — Final Motions & Adjournment", summary: livePub ? `Speaker diarization complete: ${livePub.clips} speaking-turn clips across ${livePub.speakers} speakers published to GitHub Releases!` : `Queued in ${cat.repo} automated GitHub Actions speaker-splitting pipeline.` }
      ],
      layman: {
        headline: `Plain-English Archival Guide: ${cat.title} (${cat.date})`,
        tldr: `This ${cat.year} ${cat.type} broadcast is Episode ${cat.ep_num} of Season ${cat.season} in Cheyenne's 804-episode public-access archive. Watch the full embedded Ch192 video or pull matching PDF agenda packets from ${cat.repo}.`,
        wallet_impact: `Cross-reference matching ${cat.year} agenda packets and minutes in github.com/${cat.repo} for exact dollar & ordinance text.`,
        who_cares: `Cheyenne residents researching ${cat.year} ${cat.type} decisions and historical precedent.`
      },
      tabloid: {
        banner: `FROM THE ${cat.year} VAULT: ${cat.title.toUpperCase()}!`,
        subhead: `${cat.premiere ? "Season Premiere kicks off a brand-new year at 2101 O'Neil Ave!" : "Every motion, gavel bang, and public showdown preserved on Ch192 tape!"}`,
        zingers: [{ who: `Archive Record (${cat.code})`, line: `Source identifier: ${cat.id} (${cat.size_mb} MB master recording in ${cat.repo}).` }],
        winners: ["Public Record Permanence (preserved across Archive.org + GitHub)"],
        losers: ["Memory-holed municipal history"]
      },
      legal: {
        citations: ["Wyo. Stat. § 16-4-401 et seq. (Wyoming Public Meetings Act)", "Wyo. Stat. § 16-4-201 et seq. (Wyoming Public Records Act)", `Archival Repository: ${cat.repo}`],
        posture: `Historical ${cat.type} Proceeding (${cat.date}).`,
        analysis: `Primary video evidence hosted at archive.org/details/${cat.id}; companion PDF agenda packets, supporting documents, and minutes for ${cat.year} are indexed in github.com/${cat.repo}.`,
        risk_level: "ARCHIVAL RECORD — Verifiable primary video & packet source."
      },
      geo_pins: [
        { title: "Cheyenne Municipal Building (2101 O'Neil Ave)", lat: 41.1350, lng: -104.8211, x: 46, y: 54, tag: `${cat.code} (${cat.date})` }
      ],
      historical: DB.archive_repos.map(r => ({
        era: r.years,
        repo: r.repo.split("/")[1],
        note: `${r.episodes} Ch192 meeting videos + searchable PDF agenda packets & minutes.`
      })),
      fiscal: [
        { item: `${cat.title} (${cat.date})`, fund: `See ${cat.year} Agenda Packet PDFs in ${cat.repo}`, direction: "Archival Audit", impact: `Media footprint: ${cat.size_mb} MB on Internet Archive.` }
      ],
      cast: [
        { id: "ch192", name: "Presiding Chair & Governing Body", role: cat.type, archetype: "Dais Roster", color: "#f59e0b", speaking_sec: 1800, turns: 25, share_pct: 55, quote: `Full Ch192 archival recording available via embedded Archive.org player and ${cat.repo} Releases.`, clip_start: 0, clip_end: 30, hms: "00h00m00s", zip_url: `https://github.com/${cat.repo}/releases` },
        { id: "staff", name: "City Staff & Public Testifiers", role: "Presenters & Citizens", archetype: "Floor Witnesses", color: "#14b8a6", speaking_sec: 1450, turns: 20, share_pct: 45, quote: `Automated speaker-clip ZIP extraction active in ${cat.repo}.`, clip_start: 60, clip_end: 90, hms: "00h01m00s", zip_url: `https://github.com/${cat.repo}/actions` }
      ],
      gini_index: 0.38,
      heat_timeline: Array.from({ length: 8 }, (_, i) => ({ minute: i * 12, turns: 6 + (i % 4) * 3, speakers: 3 + (i % 3) })),
      top_transitions: [{ from: "Presiding Chair", to: "Staff / Floor Speaker", count: 14 }],
      total_turns: livePub ? (livePub.clips || 45) : 45,
      transcript: [
        { n: 1, speaker: "Archival Player Ready", speaker_id: "ch192", start: 0, end: 30, hms: "00h00m00s", text: `Click 'Watch Full Archive.org Stream' to view ${cat.title} (${cat.date}), or check ${cat.repo}/releases as the automated GitHub Actions speaker splitter publishes per-speaker ZIPs newest-to-oldest.` }
      ]
    };
  }

  // =========================================================================
  // PROCEDURAL WEBAUDIO BROADCAST THEME SONG SYNTHESIZER + VISUALIZER
  // =========================================================================
  let audioCtx = null;
  let themeTimer = null;
  let isThemePlaying = false;
  let analyser = null;
  let vizAnimId = null;

  const SCORES = {
    drama: { bpm: 118, bass: [55, 55, 65.41, 73.42, 82.41, 73.42, 65.41, 49], lead: [220, 261.63, 329.63, 293.66, 329.63, 392.0, 329.63, 293.66], wave: "sawtooth" },
    synth: { bpm: 128, bass: [65.41, 65.41, 87.31, 98.0, 73.42, 73.42, 82.41, 98.0], lead: [523.25, 392.0, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66], wave: "square" },
    noir:  { bpm: 92,  bass: [46.25, 46.25, 55.0, 51.91, 41.2, 41.2, 49.0, 46.25], lead: [185.0, 220.0, 246.94, 220.0, 174.61, 196.0, 220.0, 164.81], wave: "triangle" }
  };

  function startThemeSong() {
    if (isThemePlaying) return;
    const AudioContextCls = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCls) return;
    if (!audioCtx) {
      audioCtx = new AudioContextCls();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    isThemePlaying = true;
    const btn = document.getElementById("btnThemeSong");
    if (btn) {
      btn.textContent = "🔊 Theme Song: ON";
      btn.classList.add("btn-active");
    }

    let step = 0;
    const playStep = () => {
      if (!isThemePlaying || !audioCtx) return;
      const styleKey = (document.getElementById("themeStyleSelect") || {}).value || "drama";
      const score = SCORES[styleKey] || SCORES.drama;
      const beatDur = 60 / score.bpm / 2;
      const now = audioCtx.currentTime;

      // Bass pulse
      const oscB = audioCtx.createOscillator();
      const gainB = audioCtx.createGain();
      oscB.type = "sawtooth";
      oscB.frequency.setValueAtTime(score.bass[step % score.bass.length], now);
      gainB.gain.setValueAtTime(0.11, now);
      gainB.gain.exponentialRampToValueAtTime(0.001, now + beatDur * 0.9);
      oscB.connect(gainB);
      gainB.connect(analyser);
      oscB.start(now);
      oscB.stop(now + beatDur);

      // Lead arpeggio / brass motif
      if (step % 2 === 0 || styleKey === "synth") {
        const oscL = audioCtx.createOscillator();
        const gainL = audioCtx.createGain();
        oscL.type = score.wave;
        oscL.frequency.setValueAtTime(score.lead[(step >> 1) % score.lead.length], now);
        gainL.gain.setValueAtTime(0.07, now);
        gainL.gain.exponentialRampToValueAtTime(0.001, now + beatDur * 1.4);
        oscL.connect(gainL);
        gainL.connect(analyser);
        oscL.start(now);
        oscL.stop(now + beatDur * 1.5);
      }

      // Cheyenne wind-snare accent on backbeats
      if (step % 4 === 2) {
        const bufSz = Math.floor(audioCtx.sampleRate * 0.09);
        const buf = audioCtx.createBuffer(1, bufSz, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSz; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSz);
        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;
        const gN = audioCtx.createGain();
        gN.gain.setValueAtTime(0.05, now);
        noise.connect(gN);
        gN.connect(analyser);
        noise.start(now);
      }

      step++;
      themeTimer = setTimeout(playStep, beatDur * 1000);
    };
    playStep();
    drawVisualizer();
  }

  function stopThemeSong() {
    isThemePlaying = false;
    if (themeTimer) clearTimeout(themeTimer);
    if (vizAnimId) cancelAnimationFrame(vizAnimId);
    const btn = document.getElementById("btnThemeSong");
    if (btn) {
      btn.textContent = "🎵 Theme Song: OFF";
      btn.classList.remove("btn-active");
    }
  }

  function drawVisualizer() {
    const canvas = document.getElementById("audioViz");
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    const arr = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      if (!isThemePlaying) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      analyser.getByteFrequencyData(arr);
      ctx.fillStyle = "#060913";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const bars = 12;
      const bw = canvas.width / bars;
      for (let i = 0; i < bars; i++) {
        const v = arr[i] / 255;
        const h = Math.max(2, v * canvas.height);
        ctx.fillStyle = i % 2 === 0 ? "#f59e0b" : "#06b6d4";
        ctx.fillRect(i * bw + 1, canvas.height - h, bw - 2, h);
      }
      vizAnimId = requestAnimationFrame(loop);
    };
    loop();
  }

  // =========================================================================
  // INLINE CLIP VIDEO PLAYER + INTRO MONTAGE SEQUENCER
  // =========================================================================
  window.playEpisodeClip = function (epId, startSec, endSec, label) {
    const ep = resolveActiveRecord(epId);
    const dock = document.getElementById("inlinePlayerDock");
    const vid = document.getElementById("inlineVideoEl");
    const lbl = document.getElementById("inlinePlayerLabel");
    const link = document.getElementById("inlineArchiveLink");
    if (!dock || !vid) return;

    dock.classList.add("open");
    lbl.textContent = `▶ ${label || ep.show_title} (${Math.floor(startSec / 60)}:${String(Math.floor(startSec % 60)).padStart(2, "0")})`;
    link.href = `${ep.archive_url}?start=${Math.floor(startSec)}`;

    if (ep.stream_url) {
      vid.style.display = "block";
      const existingIframe = document.getElementById("inlineEmbedFallback");
      if (existingIframe) existingIframe.remove();
      const fragUrl = `${ep.stream_url}#t=${Math.max(0, startSec)},${Math.max(startSec + 15, endSec || startSec + 30)}`;
      if (vid.src !== fragUrl) vid.src = fragUrl;
      vid.currentTime = Math.max(0, startSec);
      vid.play().catch(() => {});
    } else {
      vid.pause();
      vid.style.display = "none";
      let ifr = document.getElementById("inlineEmbedFallback");
      if (!ifr) {
        ifr = document.createElement("iframe");
        ifr.id = "inlineEmbedFallback";
        ifr.style.cssText = "width:100%;height:380px;border:none;border-radius:8px;background:#000;";
        dock.appendChild(ifr);
      }
      ifr.src = `${ep.embed_url}?start=${Math.floor(startSec)}&autoplay=1`;
    }
    dock.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  window.jumpToEpisode = function (epId) {
    if (richById[epId]) state.mode = "featured";
    else if (arcById[epId]) state.mode = "ordinances";
    else state.mode = "vault";
    state.selectedId = epId;
    syncModeButtons();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  let montageInterval = null;
  let montageStepIdx = 0;

  function openIntroMontage() {
    const ep = resolveActiveRecord(state.selectedId);
    const modal = document.getElementById("montageModal");
    const body = document.getElementById("montageVisualBody");
    const chyron = document.getElementById("montageChyron");
    const hdr = document.getElementById("montageHeaderLabel");
    if (!modal) return;

    modal.classList.add("open");
    hdr.textContent = `${ep.code} · ${ep.date} · ${ep.official_title}`;
    startThemeSong();

    const prevText = ep.previously_on && ep.previously_on.length
      ? ep.previously_on.map(p => `<div style="margin-bottom:8px;"><strong>${esc(p.label)}:</strong> ${esc(p.summary)}</div>`).join("")
      : `<div>Cheyenne Governing Body & Standing Committees set the stage across 2101 O'Neil Avenue.</div>`;

    const topCast = (ep.cast || []).slice(0, 4);
    const beats = [
      {
        chyron: "⏪ PREVIOUSLY ON THE REAL WINDY CITY...",
        html: `
          <div>
            <div class="section-kicker">BROADCAST RECAP</div>
            <h2 style="font-size:30px;margin:4px 0 14px;color:#67e8f9;">"Previously on The Real Windy City..."</h2>
            <div style="font-size:15px;line-height:1.6;color:#e2e8f0;background:rgba(6,182,212,0.1);border-left:4px solid #06b6d4;padding:14px 18px;border-radius:10px;">
              ${prevText}
            </div>
          </div>
          <div style="font-size:12px;color:#94a3b8;">Advancing to Cold Open...</div>`
      },
      {
        chyron: `🎙️ COLD OPEN — ${ep.date} · 2101 O'NEIL AVE, CHEYENNE WY`,
        html: `
          <div>
            <div class="section-kicker">COLD OPEN VERBATIM QUOTE</div>
            <blockquote style="font-size:23px;font-weight:800;line-height:1.38;margin:10px 0;color:#fef08a;">
              "${esc((topCast[0] && topCast[0].quote) || ep.layman.tldr)}"
            </blockquote>
            <div style="font-size:14px;color:#cbd5e1;">— <strong>${esc(topCast[0] ? topCast[0].name : "Official Record")}</strong> (${esc(topCast[0] ? topCast[0].hms : "00h01m41s")})</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${(ep.ordinances || []).slice(0, 3).map(o => `<span class="hero-badge">${esc(o)}</span>`).join("")}
          </div>`
      },
      {
        chyron: `🎭 TONIGHT'S STARRING CAST — ${(ep.cast || []).length} VOICES ON THE RECORD`,
        html: `
          <div>
            <div class="section-kicker">OPENING CREDITS · STARRING IN THIS EPISODE</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:10px;">
              ${topCast.map(c => `
                <div style="background:rgba(15,23,42,0.9);border:1px solid ${esc(c.color)};border-radius:12px;padding:14px;">
                  <div style="font-size:11px;font-weight:800;color:${esc(c.color)};text-transform:uppercase;">${esc(c.archetype)}</div>
                  <div style="font-size:17px;font-weight:900;margin:3px 0;">${esc(c.name)}</div>
                  <div style="font-size:12px;color:#94a3b8;">${esc(c.role)}</div>
                  <div style="font-size:11.5px;color:#fde68a;margin-top:6px;">${c.turns} turns · ${c.share_pct}% talk share</div>
                </div>
              `).join("")}
            </div>
          </div>
          <div style="font-size:12px;color:#94a3b8;">Every speaking turn clipped & archived on github.com/therealwindycity</div>`
      },
      {
        chyron: `🎬 NOW AIRING: ${ep.code} — "${ep.show_title.toUpperCase()}"`,
        html: `
          <div style="text-align:center;padding:18px 0;">
            <span class="hero-badge">${esc(ep.badge)}</span>
            <h1 style="font-size:36px;font-weight:950;margin:14px 0 8px;background:linear-gradient(90deg,#fff,#fde68a,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
              ${esc(ep.show_title)}
            </h1>
            <p style="font-size:15px;color:#cbd5e1;max-width:720px;margin:0 auto 18px;">${esc(ep.layman.tldr)}</p>
            <button class="btn btn-gold" onclick="document.getElementById('btnCloseMontage').click(); playEpisodeClip('${esc(ep.id)}', ${topCast[0] ? topCast[0].clip_start : 60}, ${topCast[0] ? topCast[0].clip_end : 120}, 'Episode Opening Highlight');">
              ▶ Watch Live Video Highlight & Enter Multi-Lens View
            </button>
          </div>`
      }
    ];

    montageStepIdx = 0;
    const renderBeat = () => {
      const b = beats[montageStepIdx % beats.length];
      body.innerHTML = b.html;
      chyron.textContent = b.chyron;
    };
    renderBeat();
    if (montageInterval) clearInterval(montageInterval);
    montageInterval = setInterval(() => {
      if (montageStepIdx < beats.length - 1) {
        montageStepIdx++;
        renderBeat();
      } else {
        clearInterval(montageInterval);
      }
    }, 4800);

    document.getElementById("btnMontageNextBeat").onclick = () => {
      montageStepIdx = (montageStepIdx + 1) % beats.length;
      renderBeat();
    };
  }

  function closeIntroMontage() {
    if (montageInterval) clearInterval(montageInterval);
    document.getElementById("montageModal").classList.remove("open");
    stopThemeSong();
  }

  // =========================================================================
  // 10 LENS RENDERERS (SAME UNIFIED DATABASE -> 10 DISTINCT INTERPRETIVE LENSES)
  // =========================================================================
  function renderLensContent(ep, lensId) {
    switch (lensId) {
      case "tv":
        return renderTVLens(ep);
      case "layman":
        return renderLaymanLens(ep);
      case "tabloid":
        return renderTabloidLens(ep);
      case "legal":
        return renderLegalLens(ep);
      case "verbatim":
        return renderVerbatimLens(ep);
      case "analytics":
        return renderAnalyticsLens(ep);
      case "map":
        return renderMapLens(ep);
      case "historical":
        return renderHistoricalLens(ep);
      case "fiscal":
        return renderFiscalLens(ep);
      case "ordinance_arc":
        return renderOrdinanceArcLens(ep);
      default:
        return renderTVLens(ep);
    }
  }

  function renderTVLens(ep) {
    const prevHtml = (ep.previously_on || []).map(p => `
      <div style="margin-top:8px;padding:9px 11px;background:rgba(6,182,212,0.08);border-radius:8px;cursor:pointer;" onclick="jumpToEpisode('${esc(p.ep_id)}')">
        <div style="font-size:11.5px;font-weight:800;color:#67e8f9;">↪ ${esc(p.label)} (Click to Watch Episode)</div>
        <div style="font-size:12.5px;color:#e2e8f0;margin-top:3px;">${esc(p.summary)}</div>
      </div>
    `).join("") || `<div style="font-size:12.5px;color:var(--text-2);">Season opening installment for this docket thread.</div>`;

    const castHtml = (ep.cast || []).map(c => {
      const initials = c.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
      return `
        <div class="cast-card">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span class="cast-avatar" style="background:${esc(c.color)};">${esc(initials)}</span>
              <div>
                <div style="font-size:10.5px;font-weight:800;color:${esc(c.color)};text-transform:uppercase;">${esc(c.archetype)}</div>
                <div style="font-size:14px;font-weight:800;">${esc(c.name)}</div>
                <div style="font-size:11.5px;color:var(--text-2);">${esc(c.role)}</div>
              </div>
            </div>
            <div style="font-size:11.5px;color:#fde68a;margin-bottom:7px;">
              ⏱️ ${Math.round(c.speaking_sec / 60)}m ${c.speaking_sec % 60}s (${c.share_pct}% share · ${c.turns} turns)
            </div>
            ${c.quote ? `<div class="cast-quote">"${esc(c.quote)}"</div>` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
            <button class="btn" style="font-size:11.5px;padding:5px 9px;" onclick="playEpisodeClip('${esc(ep.id)}', ${c.clip_start || 0}, ${c.clip_end || 30}, '${esc(c.name.replace(/'/g, ""))}')">
              ▶ Play Clip (${esc(c.hms)})
            </button>
            <a class="btn" style="font-size:11.5px;padding:5px 9px;" href="${esc(c.zip_url)}" target="_blank" rel="noopener">
              ⬇ Speaker ZIP ↗
            </a>
          </div>
        </div>`;
    }).join("");

    const actsHtml = (ep.acts || []).map(a => `
      <div class="tv-box act-card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="color:#fde68a;font-size:14px;">🎬 ${esc(a.act)}</strong>
          ${a.jump_ep ? `<button class="btn" style="font-size:11px;padding:4px 9px;" onclick="jumpToEpisode('${esc(a.jump_ep)}')">Jump to Episode ↗</button>` : ""}
        </div>
        <p style="margin:7px 0 0;font-size:13.5px;line-height:1.55;color:var(--text-1);">${esc(a.summary)}</p>
      </div>
    `).join("");

    return `
      <div>
        <div class="tv-recap-grid">
          <div class="tv-box previously">
            <div class="section-kicker" style="color:#67e8f9;">⏪ PREVIOUSLY ON THE REAL WINDY CITY...</div>
            ${prevHtml}
          </div>
          <div class="tv-box cliffhanger">
            <div class="section-kicker" style="color:#fca5a5;">⏭ TO BE CONTINUED · ON THE NEXT EPISODE...</div>
            <div style="font-size:13.5px;font-weight:800;color:#fff;margin-bottom:5px;">${esc(ep.next_episode.headline)}</div>
            <div style="font-size:12.5px;color:var(--text-1);line-height:1.5;">${esc(ep.next_episode.cliffhanger)}</div>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <div class="section-kicker">🎞️ THREE-ACT EPISODE BREAKDOWN</div>
          ${actsHtml}
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div class="section-kicker">🎭 CAST OF CHARACTERS (${(ep.cast || []).length} IDENTIFIED VOICES)</div>
            <a href="${esc(ep.release_url)}" target="_blank" rel="noopener" class="btn" style="font-size:11.5px;">
              🐙 All Speaker Video ZIPs on GitHub Releases ${ep.release_zips_count ? `(${ep.release_zips_count} live)` : ""} ↗
            </a>
          </div>
          <div class="cast-grid">${castHtml}</div>
        </div>
      </div>`;
  }

  function renderLaymanLens(ep) {
    return `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="tv-box" style="border-left:4px solid #10b981;">
          <div class="section-kicker" style="color:#6ee7b7;">☕ KITCHEN-TABLE CHEYENNE · PLAIN-ENGLISH SUMMARY</div>
          <h3 style="font-size:21px;margin:4px 0 10px;">${esc(ep.layman.headline)}</h3>
          <p style="font-size:15px;line-height:1.68;color:#e2e8f0;margin:0;">${esc(ep.layman.tldr)}</p>
        </div>

        <div class="tv-recap-grid">
          <div class="tv-box">
            <div class="section-kicker">💵 HOW THIS HITS YOUR WALLET & PROPERTY</div>
            <p style="font-size:13.5px;line-height:1.6;color:var(--text-1);margin:4px 0 0;">${esc(ep.layman.wallet_impact)}</p>
          </div>
          <div class="tv-box">
            <div class="section-kicker">🏡 WHO IN CHEYENNE SHOULD PAY ATTENTION</div>
            <p style="font-size:13.5px;line-height:1.6;color:var(--text-1);margin:4px 0 0;">${esc(ep.layman.who_cares)}</p>
          </div>
        </div>

        <div class="tv-box">
          <div class="section-kicker">📋 ORDINANCES & ITEMS TRANSLATED WITHOUT BUREAUCRAT-SPEAK</div>
          <ul style="margin:8px 0 0;padding-left:18px;line-height:1.75;font-size:13.5px;color:#e2e8f0;">
            ${(ep.ordinances || []).map(o => `<li><strong>${esc(o)}</strong></li>`).join("")}
          </ul>
        </div>
      </div>`;
  }

  function renderTabloidLens(ep) {
    const t = ep.tabloid;
    return `
      <div class="tabloid-sheet">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid rgba(239,68,68,0.5);padding-bottom:8px;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <span style="font-weight:950;letter-spacing:0.14em;color:#fca5a5;font-size:12px;">🗞️ THE WINDY CITY DISPATCH · CAPITOL AVE TEA EDITION</span>
          <span style="background:#ef4444;color:#fff;font-weight:900;font-size:11.5px;padding:3px 10px;border-radius:999px;">SPICE / DRAMA RATING: ${ep.drama_score} / 10</span>
        </div>
        <div class="tabloid-banner">${esc(t.banner)}</div>
        <p style="font-size:15.5px;font-weight:600;color:#fecdd3;margin:0 0 18px;line-height:1.5;">${esc(t.subhead)}</p>

        <div class="tv-box" style="background:rgba(0,0,0,0.42);margin-bottom:14px;border-color:rgba(239,68,68,0.4);">
          <div class="section-kicker" style="color:#fda4af;">🔥 OVERHEARD ON THE RECORD (VERBATIM MOMENTS)</div>
          ${(t.zingers || []).map(z => `
            <div style="margin:10px 0;padding-left:12px;border-left:3px solid #f59e0b;">
              <div style="font-size:11.5px;font-weight:800;color:#fde68a;">${esc(z.who)}</div>
              <div style="font-size:14px;color:#fff;margin-top:2px;">"${esc(z.line)}"</div>
            </div>
          `).join("")}
        </div>

        <div class="tv-recap-grid">
          <div class="tv-box" style="background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.35);">
            <div class="section-kicker" style="color:#6ee7b7;">🏆 NIGHT'S WINNERS</div>
            <ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px;line-height:1.6;">
              ${(t.winners || []).map(w => `<li>${esc(w)}</li>`).join("")}
            </ul>
          </div>
          <div class="tv-box" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.35);">
            <div class="section-kicker" style="color:#fca5a5;">💥 ON THE HOT SEAT</div>
            <ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px;line-height:1.6;">
              ${(t.losers || []).map(l => `<li>${esc(l)}</li>`).join("")}
            </ul>
          </div>
        </div>
      </div>`;
  }

  function renderLegalLens(ep) {
    const lg = ep.legal;
    return `
      <div class="legal-brief">
        <div style="font-family:'Inter',sans-serif;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <span class="section-kicker" style="color:#a5b4fc;margin:0;">⚖️ MUNICIPAL & STATUTORY LEGAL MEMORANDUM</span>
          <span class="hero-badge" style="background:rgba(99,102,241,0.2);color:#c7d2fe;border-color:#818cf8;">EXPOSURE: ${esc(lg.risk_level)}</span>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-family:'Inter',sans-serif;font-size:11.5px;font-weight:800;color:#94a3b8;text-transform:uppercase;">I. Controlling Authorities & Code Citations</div>
          <ul style="margin:6px 0 0;padding-left:20px;line-height:1.7;font-size:14px;color:#e2e8f0;">
            ${(lg.citations || []).map(c => `<li><code>${esc(c)}</code></li>`).join("")}
          </ul>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-family:'Inter',sans-serif;font-size:11.5px;font-weight:800;color:#94a3b8;text-transform:uppercase;">II. Procedural Posture</div>
          <p style="margin:6px 0 0;font-size:14.5px;line-height:1.65;color:#f1f5f9;">${esc(lg.posture)}</p>
        </div>

        <div>
          <div style="font-family:'Inter',sans-serif;font-size:11.5px;font-weight:800;color:#94a3b8;text-transform:uppercase;">III. Statutory, Constitutional & Administrative Law Implications</div>
          <p style="margin:6px 0 0;font-size:15px;line-height:1.75;color:#f8fafc;">${esc(lg.analysis)}</p>
        </div>
      </div>`;
  }

  function renderVerbatimLens(ep) {
    const spkOptions = Array.from(new Set((ep.transcript || []).map(t => t.speaker)));
    const q = state.transcriptSearch.trim().toLowerCase();
    const filtered = (ep.transcript || []).filter(t => {
      if (state.transcriptSpeaker !== "ALL" && t.speaker !== state.transcriptSpeaker) return false;
      if (q && !t.text.toLowerCase().includes(q) && !t.speaker.toLowerCase().includes(q)) return false;
      return true;
    });

    return `
      <div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">
          <input type="search" class="search-ctrl" placeholder="Filter verbatim transcript words..." value="${esc(state.transcriptSearch)}" oninput="window._updateTranscriptFilter(this.value, null)" style="flex:1;min-width:200px;" />
          <select class="select-ctrl" onchange="window._updateTranscriptFilter(null, this.value)">
            <option value="ALL">All Speakers (${spkOptions.length})</option>
            ${spkOptions.map(s => `<option value="${esc(s)}" ${state.transcriptSpeaker === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
          </select>
          <button class="btn btn-gold" onclick="playEpisodeClip('${esc(ep.id)}', 0, 120, 'Full Broadcast Stream')">▶ Open Broadcast Stream</button>
          <a href="${esc(ep.release_url)}" target="_blank" rel="noopener" class="btn">⬇ Speaker ZIPs on GitHub ↗</a>
        </div>

        <div style="font-size:12px;color:var(--text-2);margin-bottom:10px;">
          Showing <strong>${filtered.length}</strong> of <strong>${ep.total_turns}</strong> diarized speaking turns · Source: <a href="${esc(ep.archive_url)}" target="_blank" rel="noopener">${esc(ep.id)}</a>
        </div>

        <div style="max-height:560px;overflow-y:auto;padding-right:4px;">
          ${filtered.slice(0, 120).map(t => `
            <div class="transcript-row">
              <div>
                <div style="font-size:12.5px;font-weight:800;color:#fde68a;">${esc(t.speaker)}</div>
                <div style="font-size:11px;font-family:monospace;color:var(--text-2);margin-top:2px;">Turn #${t.n} · ${esc(t.hms)}</div>
              </div>
              <div style="font-size:13.5px;line-height:1.55;color:#e2e8f0;">${esc(t.text)}</div>
              <div>
                <button class="btn" style="font-size:11.5px;padding:5px 9px;" onclick="playEpisodeClip('${esc(ep.id)}', ${t.start}, ${t.end}, '${esc(t.speaker.replace(/'/g, ""))}')">▶ Play</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>`;
  }

  function renderAnalyticsLens(ep) {
    const maxTurns = Math.max(1, ...(ep.heat_timeline || []).map(h => h.turns));
    return `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="tv-recap-grid">
          <div class="tv-box">
            <div class="section-kicker">SPEAKING CONCENTRATION (GINI)</div>
            <div style="font-size:28px;font-weight:900;color:#67e8f9;">${ep.gini_index}</div>
            <div style="font-size:12px;color:var(--text-2);">0.00 = equal floor time · 1.00 = single-voice monologue</div>
          </div>
          <div class="tv-box">
            <div class="section-kicker">DIARIZED SPEAKING TURNS</div>
            <div style="font-size:28px;font-weight:900;color:#fde68a;">${ep.total_turns}</div>
            <div style="font-size:12px;color:var(--text-2);">Across ${(ep.cast || []).length} primary speakers · ${fmtDur(ep.duration_sec)} runtime</div>
          </div>
          <div class="tv-box">
            <div class="section-kicker">GITHUB RELEASE ARCHIVES</div>
            <div style="font-size:28px;font-weight:900;color:#6ee7b7;">${ep.release_zips_count || "Auto-Queued"}</div>
            <div style="font-size:12px;color:var(--text-2);">Repo: <code>${esc(ep.github_repo)}</code></div>
          </div>
        </div>

        <div class="tv-box">
          <div class="section-kicker">📈 DEBATE EXCHANGE CADENCE OVER MEETING TIMELINE</div>
          <div style="display:grid;grid-template-columns:repeat(${(ep.heat_timeline || []).length},1fr);gap:6px;align-items:end;height:130px;padding-top:16px;">
            ${(ep.heat_timeline || []).map(h => {
              const pct = Math.max(10, Math.round((h.turns / maxTurns) * 100));
              return `
                <div style="display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
                  <div style="font-size:10px;color:#fde68a;margin-bottom:3px;">${h.turns}</div>
                  <div style="width:100%;height:${pct}%;background:linear-gradient(180deg,#f59e0b,#06b6d4);border-radius:5px 5px 0 0;" title="Min ${h.minute}: ${h.turns} speaker turns (${h.speakers} distinct voices)"></div>
                  <div style="font-size:10px;color:var(--text-2);margin-top:4px;">${h.minute}m</div>
                </div>`;
            }).join("")}
          </div>
        </div>

        <div class="tv-recap-grid">
          <div class="tv-box">
            <div class="section-kicker">🎙️ SHARE OF VOICE BY CAST MEMBER</div>
            ${(ep.cast || []).slice(0, 8).map(c => `
              <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                  <span>${esc(c.name)}</span>
                  <strong>${c.share_pct}% (${c.turns} turns)</strong>
                </div>
                <div style="height:8px;background:#090d16;border-radius:999px;overflow:hidden;">
                  <div style="height:100%;width:${Math.min(100, c.share_pct * 2.2)}%;background:${esc(c.color)};"></div>
                </div>
              </div>
            `).join("")}
          </div>

          <div class="tv-box">
            <div class="section-kicker">🔄 TOP BACK-AND-FORTH DIALOGUE PAIRS</div>
            ${(ep.top_transitions || []).map(tr => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(148,163,184,0.1);font-size:12.5px;">
                <span>${esc(tr.from)} → ${esc(tr.to)}</span>
                <strong style="color:#67e8f9;">${tr.count}×</strong>
              </div>
            `).join("")}
          </div>
        </div>
      </div>`;
  }

  function renderMapLens(ep) {
    const pins = ep.geo_pins || [];
    return `
      <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,1fr);gap:16px;">
        <div class="tv-box" style="padding:12px;">
          <div class="section-kicker">🗺️ CHEYENNE CORRIDOR & PARCEL IMPACT MAP (LARAMIE COUNTY, WY)</div>
          <svg viewBox="0 0 100 100" style="width:100%;height:390px;background:#08101f;border-radius:10px;border:1px solid var(--border);">
            <!-- Grid -->
            <g stroke="rgba(148,163,184,0.08)" stroke-width="0.4">
              <line x1="0" y1="20" x2="100" y2="20"/><line x1="0" y1="40" x2="100" y2="40"/>
              <line x1="0" y1="60" x2="100" y2="60"/><line x1="0" y1="80" x2="100" y2="80"/>
              <line x1="20" y1="0" x2="20" y2="100"/><line x1="40" y1="0" x2="40" y2="100"/>
              <line x1="60" y1="0" x2="60" y2="100"/><line x1="80" y1="0" x2="80" y2="100"/>
            </g>
            <!-- Crow Creek -->
            <path d="M 5 52 Q 35 62, 55 56 T 96 66" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="2,1.5" />
            <text x="8" y="50" fill="#38bdf8" font-size="2.7">Crow Creek</text>

            <!-- Major Cheyenne Highways & Arterials -->
            <!-- I-25 North-South -->
            <path d="M 28 2 L 26 98" fill="none" stroke="#f59e0b" stroke-width="1.8" opacity="0.75" />
            <text x="29" y="10" fill="#fde68a" font-size="3" font-weight="bold">I-25</text>

            <!-- I-80 East-West -->
            <path d="M 2 70 L 98 68" fill="none" stroke="#f59e0b" stroke-width="1.8" opacity="0.75" />
            <text x="6" y="67" fill="#fde68a" font-size="3" font-weight="bold">I-80</text>

            <!-- Dell Range Blvd -->
            <path d="M 30 28 L 92 28" fill="none" stroke="#94a3b8" stroke-width="1.0" />
            <text x="58" y="26" fill="#cbd5e1" font-size="2.6">Dell Range Blvd</text>

            <!-- Pershing / Story Blvd -->
            <path d="M 30 42 L 94 41" fill="none" stroke="#94a3b8" stroke-width="0.9" />
            <text x="64" y="39.5" fill="#cbd5e1" font-size="2.5">Pershing / Story Blvd</text>

            <!-- US-30 / Lincolnway -->
            <path d="M 18 54 L 96 47" fill="none" stroke="#cbd5e1" stroke-width="1.1" />
            <text x="74" y="46" fill="#e2e8f0" font-size="2.6">US-30 / Lincolnway</text>

            <!-- South College & Fox Farm -->
            <path d="M 67 28 L 67 92" fill="none" stroke="#64748b" stroke-width="0.8" />
            <text x="68.5" y="88" fill="#94a3b8" font-size="2.5">S. College Dr / Fox Farm</text>

            <!-- Reed Ave Rail Corridor -->
            <path d="M 39 46 L 39 66" fill="none" stroke="#10b981" stroke-width="1.2" />
            <text x="31" y="63" fill="#6ee7b7" font-size="2.4">Reed Ave</text>

            <!-- Episode Pins -->
            ${pins.map((p, idx) => `
              <g transform="translate(${p.x}, ${p.y})">
                <circle r="4.2" fill="rgba(239,68,68,0.28)">
                  <animate attributeName="r" values="3;6.5;3" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle r="2.3" fill="#ef4444" stroke="#fff" stroke-width="0.6" />
                <text x="3.5" y="1" fill="#fef08a" font-size="2.9" font-weight="bold">#${idx + 1} ${esc(p.tag)}</text>
              </g>
            `).join("")}
          </svg>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="section-kicker">📍 GEOLOCATED DOCKET SITES IN THIS EPISODE</div>
          ${pins.map((p, idx) => `
            <div class="tv-box">
              <div style="font-size:11px;font-weight:800;color:#fca5a5;">PIN #${idx + 1} · ${esc(p.tag)}</div>
              <div style="font-size:14px;font-weight:800;margin:3px 0;">${esc(p.title)}</div>
              <div style="font-size:11.5px;color:var(--text-2);font-family:monospace;">Lat ${p.lat.toFixed(4)}° N, Lng ${p.lng.toFixed(4)}° W</div>
              <a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}" target="_blank" rel="noopener" style="font-size:11.5px;display:inline-block;margin-top:6px;">
                Open Parcel Area on OpenStreetMap ↗
              </a>
            </div>
          `).join("")}
        </div>
      </div>`;
  }

  function renderHistoricalLens(ep) {
    return `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="tv-box">
          <div class="section-kicker">🏛️ HOW CHEYENNE HANDLED THIS ACROSS ERAS (2008–2026 PRECEDENT)</div>
          ${(ep.historical || []).map(h => `
            <div style="padding:11px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;">
              <div>
                <span class="hero-badge" style="margin-right:8px;">${esc(h.era)}</span>
                <span style="font-size:13.5px;color:#e2e8f0;">${esc(h.note)}</span>
              </div>
              <a class="btn" style="font-size:11.5px;" href="https://github.com/therealwindycity/${esc(h.repo)}" target="_blank" rel="noopener">
                Open ${esc(h.repo)} ↗
              </a>
            </div>
          `).join("")}
        </div>

        <div class="tv-box">
          <div class="section-kicker">🐙 CONNECTED THEREALWINDYCITY 6-REPO PUBLIC ARCHIVE FAMILY (804 VIDEOS + PDF PACKETS)</div>
          <div class="cast-grid">
            ${DB.archive_repos.map(r => `
              <div class="cast-card">
                <div>
                  <div style="font-size:11px;font-weight:800;color:var(--gold);">YEARS ${esc(r.years)}</div>
                  <div style="font-size:14px;font-weight:800;margin:4px 0;">${esc(r.repo.split("/")[1])}</div>
                  <div style="font-size:12px;color:var(--text-2);">${r.episodes} Ch192 Meeting Videos + Searchable PDF Packets & Automated Speaker Releases</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <a class="btn" style="font-size:11px;padding:4px 8px;" href="https://github.com/${esc(r.repo)}" target="_blank" rel="noopener">PDF Tree ↗</a>
                  <a class="btn" style="font-size:11px;padding:4px 8px;" href="https://github.com/${esc(r.repo)}/releases" target="_blank" rel="noopener">Speaker ZIPs ↗</a>
                  <a class="btn" style="font-size:11px;padding:4px 8px;" href="https://github.com/${esc(r.repo)}/actions" target="_blank" rel="noopener">Actions Runner ↗</a>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>`;
  }

  function renderFiscalLens(ep) {
    return `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="tv-box" style="border-left:4px solid #10b981;">
          <div class="section-kicker" style="color:#6ee7b7;">💰 FOLLOW THE MONEY · FISCAL & TAXPAYER LEDGER</div>
          ${(ep.fiscal || []).map(f => `
            <div style="padding:12px;background:var(--bg-1);border:1px solid var(--border);border-radius:10px;margin-top:10px;">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <strong style="font-size:14.5px;color:#fff;">${esc(f.item)}</strong>
                <span class="hero-badge">${esc(f.direction)} · ${esc(f.fund)}</span>
              </div>
              <p style="margin:6px 0 0;font-size:13.5px;color:var(--text-1);">${esc(f.impact)}</p>
            </div>
          `).join("")}
        </div>
      </div>`;
  }

  function renderOrdinanceArcLens(ep) {
    // Find matching ordinance arcs that include this episode
    const matchingArcs = DB.ordinance_arcs.filter(a =>
      a.id === ep.id || a.episodes_in_arc.some(s => s.ep_id === ep.id)
    );
    const arcsToShow = matchingArcs.length ? matchingArcs : DB.ordinance_arcs.slice(0, 3);

    return `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="tv-box">
          <div class="section-kicker">🧭 WYOMING 3-READING MUNICIPAL ORDINANCE PIPELINE (WYO. STAT. § 15-1-103)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-top:10px;">
            ${[
              "1. Planning / Staff Draft",
              "2. Council 1st Reading",
              "3. Standing Committee Hearing",
              "4. Council 2nd Reading & Amendments",
              "5. Committee Re-Referral (If Amended)",
              "6. Council 3rd & Final Vote"
            ].map(st => `<div style="background:var(--bg-1);border:1px solid var(--border);padding:9px 11px;border-radius:9px;font-size:12px;font-weight:700;color:#fde68a;">${esc(st)}</div>`).join("")}
          </div>
        </div>

        ${arcsToShow.map(arc => `
          <div class="tv-box" style="border-left:4px solid var(--gold);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <div>
                <div class="section-kicker">${esc(arc.code)} · ${esc(arc.ordinance_number)}</div>
                <h4 style="margin:2px 0 6px;font-size:17px;">${esc(arc.show_title)}</h4>
              </div>
              <button class="btn btn-gold" style="font-size:11.5px;" onclick="jumpToEpisode('${esc(arc.id)}')">
                📺 Open Full Ordinance Mini-Series
              </button>
            </div>
            <p style="font-size:13px;color:var(--text-1);margin:0 0 10px;">${esc(arc.summary)}</p>
            <div style="display:flex;flex-direction:column;gap:7px;">
              ${arc.episodes_in_arc.map(s => `
                <div style="padding:8px 11px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                  <div>
                    <strong style="color:#67e8f9;font-size:12.5px;">${esc(s.stage)} (${esc(s.date)})</strong>
                    <div style="font-size:12px;color:var(--text-1);">${esc(s.note)}</div>
                  </div>
                  <button class="btn" style="font-size:11px;padding:4px 9px;" onclick="jumpToEpisode('${esc(s.ep_id)}')">Watch Episode ↗</button>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>`;
  }

  // =========================================================================
  // VIEWPORT RENDERERS (SINGLE SWIPE / SPLIT 2-3 / FLOATING IFRAMES MATRIX)
  // =========================================================================
  function renderViewport() {
    const ep = resolveActiveRecord(state.selectedId);
    const vp = document.getElementById("lensViewport");
    if (!vp) return;

    if (isEmbed) {
      const lensObj = LENSES.find(l => l.id === state.activeLens) || LENSES[0];
      vp.innerHTML = `
        <div style="padding:6px 4px;">
          <div style="font-size:11px;font-weight:800;color:var(--gold);margin-bottom:8px;">
            ${lensObj.icon} ${esc(lensObj.name.toUpperCase())} LENS — ${esc(ep.show_title)} (${esc(ep.date)})
          </div>
          ${renderLensContent(ep, lensObj.id)}
        </div>`;
      return;
    }

    if (state.viewMode === "swipe") {
      const idx = LENSES.findIndex(l => l.id === state.activeLens);
      const prevL = LENSES[(idx - 1 + LENSES.length) % LENSES.length];
      const nextL = LENSES[(idx + 1) % LENSES.length];
      const curL = LENSES[idx];

      vp.innerHTML = `
        <div id="swipeSurface" class="lens-Swipe-wrapper">
          <div class="swipe-nav-hint">
            <button class="btn" onclick="window._stepLens(-1)">← Swipe Right: ${prevL.icon} ${esc(prevL.name)}</button>
            <div style="text-align:center;">
              <strong style="color:#fde68a;font-size:14px;">${curL.icon} ${esc(curL.name)}</strong>
              <span style="margin-left:8px;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.16);color:#fcd34d;font-size:11px;">Diet: ${esc(curL.diet)} (${idx + 1}/${LENSES.length})</span>
            </div>
            <button class="btn" onclick="window._stepLens(1)">Swipe Left: ${nextL.icon} ${esc(nextL.name)} →</button>
          </div>
          ${renderLensContent(ep, curL.id)}
        </div>`;
      bindSwipeGestures(document.getElementById("swipeSurface"));
    } else if (state.viewMode === "split2" || state.viewMode === "split3") {
      const count = state.viewMode === "split2" ? 2 : 3;
      const colsHtml = Array.from({ length: count }, (_, paneIdx) => {
        const lid = state.splitLenses[paneIdx] || LENSES[paneIdx].id;
        return `
          <div class="split-pane">
            <div class="split-pane-header">
              <span style="font-size:11.5px;font-weight:800;color:var(--gold);">LENS PANE #${paneIdx + 1}</span>
              <select class="select-ctrl" onchange="window._setSplitLens(${paneIdx}, this.value)">
                ${LENSES.map(l => `<option value="${l.id}" ${l.id === lid ? "selected" : ""}>${l.icon} ${esc(l.name)} (${esc(l.diet)})</option>`).join("")}
              </select>
            </div>
            ${renderLensContent(ep, lid)}
          </div>`;
      }).join("");
      vp.innerHTML = `<div class="split-grid cols-${count}">${colsHtml}</div>`;
    } else if (state.viewMode === "iframes") {
      const baseUrl = window.location.pathname;
      const modeCls = state.iframeLayout === "free" ? "free-mode" : "tiled-mode";
      vp.innerHTML = `
        <div>
          <div class="iframe-deck-toolbar">
            <div>
              <strong style="color:#fde68a;">🪟 All 10 Lenses in Live Independent Iframes</strong>
              <span style="font-size:12px;color:var(--text-2);margin-left:8px;">Click <strong>⤢ Expand</strong> on any floating iframe to spotlight full-screen, or switch to Free-Drag Canvas to arrange windows anywhere.</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn ${state.iframeLayout === "tiled" ? "btn-active" : ""}" onclick="window._setIframeLayout('tiled')">▦ Tiled Bento Grid</button>
              <button class="btn ${state.iframeLayout === "free" ? "btn-active" : ""}" onclick="window._setIframeLayout('free')">✋ Free-Floating Draggable Windows</button>
            </div>
          </div>

          <div id="iframeCanvas" class="iframe-canvas ${modeCls}">
            ${LENSES.map((l, idx) => {
              const left = 18 + (idx % 3) * 425;
              const top = 18 + Math.floor(idx / 3) * 325;
              const posStyle = state.iframeLayout === "free" ? `left:${left}px;top:${top}px;z-index:${10 + idx};` : "";
              const src = `${baseUrl}?embed=1&lens=${encodeURIComponent(l.id)}&item=${encodeURIComponent(ep.id)}`;
              return `
                <div class="floating-iframe-win" id="fwin-${l.id}" style="${posStyle}">
                  <div class="win-titlebar" data-win="fwin-${l.id}">
                    <span class="win-title">${l.icon} ${esc(l.name)} <span style="font-weight:400;color:#94a3b8;">· ${esc(l.diet)}</span></span>
                    <div style="display:flex;gap:5px;">
                      <button class="btn" style="padding:2px 7px;font-size:11px;" onclick="window._promoteLens('${l.id}')" title="Open in Single Swipe View">Single</button>
                      <button class="btn btn-gold" style="padding:2px 8px;font-size:11px;" onclick="window._toggleExpandWin('fwin-${l.id}')">⤢ Expand</button>
                    </div>
                  </div>
                  <iframe class="win-iframe" src="${esc(src)}" loading="lazy" title="${esc(l.name)} Lens"></iframe>
                </div>`;
            }).join("")}
          </div>
        </div>`;

      if (state.iframeLayout === "free") {
        const canvas = document.getElementById("iframeCanvas");
        canvas.style.minHeight = "1360px";
        enableWindowDragging(canvas);
      }
    }
  }

  function bindSwipeGestures(el) {
    if (!el) return;
    let startX = null;
    let startY = null;
    el.addEventListener("touchstart", e => {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    }, { passive: true });
    el.addEventListener("touchend", e => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        window._stepLens(dx < 0 ? 1 : -1); // swipe left -> next lens
      }
      startX = null;
    }, { passive: true });

    // Mouse horizontal drag on non-interactive background
    let mDownX = null;
    el.addEventListener("mousedown", e => {
      if (["BUTTON", "A", "INPUT", "SELECT", "VIDEO"].includes(e.target.tagName)) return;
      mDownX = e.clientX;
    });
    el.addEventListener("mouseup", e => {
      if (mDownX == null) return;
      const dx = e.clientX - mDownX;
      if (Math.abs(dx) > 95 && window.getSelection().toString().length === 0) {
        window._stepLens(dx < 0 ? 1 : -1);
      }
      mDownX = null;
    });
  }

  function enableWindowDragging(canvas) {
    let topZ = 30;
    canvas.querySelectorAll(".win-titlebar").forEach(bar => {
      bar.addEventListener("mousedown", e => {
        if (e.target.tagName === "BUTTON") return;
        const win = document.getElementById(bar.dataset.win);
        if (!win || win.classList.contains("expanded")) return;
        win.style.zIndex = ++topZ;
        const startX = e.clientX;
        const startY = e.clientY;
        const origLeft = parseInt(win.style.left || "20", 10);
        const origTop = parseInt(win.style.top || "20", 10);

        const onMove = ev => {
          win.style.left = Math.max(0, origLeft + (ev.clientX - startX)) + "px";
          win.style.top = Math.max(0, origTop + (ev.clientY - startY)) + "px";
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    });
  }

  // Global UI hooks
  window._stepLens = function (delta) {
    const idx = LENSES.findIndex(l => l.id === state.activeLens);
    state.activeLens = LENSES[(idx + delta + LENSES.length) % LENSES.length].id;
    renderLensBar();
    renderViewport();
  };

  window._setSplitLens = function (paneIdx, lensId) {
    state.splitLenses[paneIdx] = lensId;
    renderViewport();
  };

  window._setIframeLayout = function (layout) {
    state.iframeLayout = layout;
    renderViewport();
  };

  window._toggleExpandWin = function (winId) {
    const el = document.getElementById(winId);
    if (!el) return;
    el.classList.toggle("expanded");
  };

  window._promoteLens = function (lensId) {
    state.activeLens = lensId;
    state.viewMode = "swipe";
    syncViewModeButtons();
    renderLensBar();
    renderViewport();
  };

  window._updateTranscriptFilter = function (qVal, spkVal) {
    if (qVal !== null) state.transcriptSearch = qVal;
    if (spkVal !== null) state.transcriptSpeaker = spkVal;
    renderViewport();
  };

  // =========================================================================
  // HERO, SIDEBAR GUIDE & LENS PILL BAR
  // =========================================================================
  function renderHero() {
    if (isEmbed) return;
    const ep = resolveActiveRecord(state.selectedId);
    const hero = document.getElementById("heroCard");
    if (!hero) return;

    hero.innerHTML = `
      <div class="hero-top">
        <div style="max-width:920px;">
          <div class="hero-badge-row">
            <span class="hero-badge">${esc(ep.code)}</span>
            <span class="hero-badge">${esc(ep.badge)}</span>
            <span class="hero-badge" style="background:rgba(6,182,212,0.16);color:#67e8f9;border-color:rgba(6,182,212,0.4);">${esc(ep.meeting_type)} · ${esc(ep.date)}</span>
          </div>
          <h1 class="hero-title">${esc(ep.show_title)}</h1>
          <div class="hero-sub">
            Official Docket: <strong>${esc(ep.official_title)}</strong> · Runtime: <strong>${fmtDur(ep.duration_sec)}</strong> ·
            Cast: <strong>${(ep.cast || []).length} Speakers</strong> ·
            <a href="${esc(ep.release_url)}" target="_blank" rel="noopener">GitHub Speaker ZIPs ↗</a> ·
            <a href="${esc(ep.archive_url)}" target="_blank" rel="noopener">Archive.org Source ↗</a>
          </div>
        </div>

        <div class="drama-meter">
          <div style="font-size:10.5px;font-weight:800;color:var(--text-2);letter-spacing:0.08em;">CIVIC INTENSITY</div>
          <div class="drama-num">${ep.drama_score} <span style="font-size:13px;color:var(--text-2);">/ 10</span></div>
          <div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end;">
            <button class="btn btn-gold" style="font-size:11.5px;padding:5px 10px;" onclick="playEpisodeClip('${esc(ep.id)}', ${(ep.cast && ep.cast[0]) ? ep.cast[0].clip_start : 60}, ${(ep.cast && ep.cast[0]) ? ep.cast[0].clip_end : 120}, 'Episode Lead Highlight')">
              ▶ Watch Highlight
            </button>
          </div>
        </div>
      </div>`;
  }

  function renderLensBar() {
    if (isEmbed) return;
    const bar = document.getElementById("lensPills");
    const preview = document.getElementById("lensHoverPreview");
    const ep = resolveActiveRecord(state.selectedId);

    bar.innerHTML = LENSES.map(l => `
      <button class="lens-pill ${state.activeLens === l.id && state.viewMode === "swipe" ? "active" : ""}" data-lens="${l.id}">
        ${l.icon} ${esc(l.name)}
      </button>
    `).join("");

    bar.querySelectorAll(".lens-pill").forEach(btn => {
      const lObj = LENSES.find(x => x.id === btn.dataset.lens);
      btn.addEventListener("mouseenter", () => {
        if (!lObj) return;
        preview.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:#fde68a;font-size:13.5px;">${lObj.icon} ${esc(lObj.name)} — <span style="color:#67e8f9;">${esc(lObj.diet)}</span></strong>
            <span style="font-size:11px;color:var(--text-2);">Click to switch · Or use 2/3-Up & Floating Iframes</span>
          </div>
          <div style="font-size:12.5px;color:#e2e8f0;margin-top:4px;">${esc(lObj.desc)}</div>
          <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Active target: <em>${esc(ep.show_title)}</em></div>`;
        preview.classList.add("visible");
      });
      btn.addEventListener("mouseleave", () => preview.classList.remove("visible"));
      btn.addEventListener("click", () => {
        state.activeLens = lObj.id;
        if (state.viewMode !== "swipe") {
          state.splitLenses[0] = lObj.id;
        }
        renderLensBar();
        renderViewport();
      });
    });
  }

  function renderGuideSidebar() {
    if (isEmbed) return;
    const listEl = document.getElementById("guideList");
    const countLbl = document.getElementById("guideCountLabel");
    const q = state.search.trim().toLowerCase();

    let items = [];
    if (state.mode === "featured") {
      items = DB.rich_episodes.filter(ep => {
        if (state.season !== "ALL" && String(ep.year) !== state.season) return false;
        if (state.type !== "ALL" && ep.meeting_type !== state.type) return false;
        if (state.speaker !== "ALL" && !(ep.cast || []).some(c => c.name === state.speaker)) return false;
        if (q) {
          const hay = `${ep.date} ${ep.official_title} ${ep.show_title} ${(ep.ordinances || []).join(" ")} ${(ep.cast || []).map(c => c.name).join(" ")}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }).map(ep => ({
        id: ep.id,
        code: ep.code,
        date: ep.date,
        showTitle: ep.show_title,
        sub: `${ep.official_title} · ${(ep.cast || []).length} cast`,
        pills: [
          ep.release_zips_count ? { cls: "release", text: `${ep.release_zips_count} Speaker ZIPs` } : { cls: "", text: ep.meeting_type }
        ]
      }));
    } else if (state.mode === "ordinances") {
      items = DB.ordinance_arcs.filter(a => {
        if (q && !`${a.show_title} ${a.ordinance_number} ${a.summary}`.toLowerCase().includes(q)) return false;
        return true;
      }).map(a => ({
        id: a.id,
        code: a.code.split("·")[0].trim(),
        date: a.date,
        showTitle: a.show_title,
        sub: a.ordinance_number,
        pills: [{ cls: "premiere", text: `${a.episodes_in_arc.length}-Episode Arc` }]
      }));
    } else {
      items = DB.catalog_804.filter(c => {
        if (state.season !== "ALL" && String(c.year) !== state.season) return false;
        if (state.type !== "ALL" && c.type !== state.type) return false;
        if (q && !`${c.date} ${c.title} ${c.code} ${c.type}`.toLowerCase().includes(q)) return false;
        return true;
      }).map(c => {
        const pills = [];
        if (c.premiere) pills.push({ cls: "premiere", text: "Season Premiere" });
        if (c.finale) pills.push({ cls: "finale", text: "Season Finale" });
        if (c.has_deep_pack) pills.push({ cls: "release", text: "Full Multi-Lens" });
        if (state.livePublishedState[c.id]) pills.push({ cls: "release", text: "ZIPs Live" });
        return {
          id: c.id,
          code: c.code,
          date: c.date,
          showTitle: c.title,
          sub: `${c.type} · ${c.size_mb} MB`,
          pills
        };
      });
    }

    countLbl.textContent = `${items.length} ${state.mode === "ordinances" ? "Ordinance Series" : "Episodes"}`;
    listEl.innerHTML = items.slice(0, 250).map(it => `
      <div class="ep-card ${state.selectedId === it.id ? "selected" : ""}" data-id="${esc(it.id)}">
        <div class="ep-meta-row">
          <span class="ep-code">${esc(it.code)}</span>
          <span>${esc(it.date)}</span>
        </div>
        <div class="ep-show-title">${esc(it.showTitle)}</div>
        <div class="ep-official-sub">${esc(it.sub)}</div>
        <div>
          ${it.pills.map(p => `<span class="mini-pill ${p.cls}">${esc(p.text)}</span>`).join("")}
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".ep-card").forEach(card => {
      card.addEventListener("click", () => {
        state.selectedId = card.dataset.id;
        state.transcriptSearch = "";
        state.transcriptSpeaker = "ALL";
        renderAll();
      });
    });
  }

  function populateFilters() {
    if (isEmbed) return;
    const sSel = document.getElementById("seasonFilter");
    const years = Array.from(new Set(DB.catalog_804.map(c => c.year))).sort((a, b) => b - a);
    years.forEach(yr => {
      const opt = document.createElement("option");
      opt.value = String(yr);
      opt.textContent = `Season ${Math.max(1, yr - 2011)} (${yr})`;
      sSel.appendChild(opt);
    });

    const spkSel = document.getElementById("speakerFilter");
    const spkNames = new Set();
    DB.rich_episodes.forEach(ep => (ep.cast || []).forEach(c => spkNames.add(c.name)));
    Array.from(spkNames).sort().forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = `Cast: ${n}`;
      spkSel.appendChild(opt);
    });
  }

  function syncModeButtons() {
    document.querySelectorAll(".mode-tab").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === state.mode);
    });
  }

  function syncViewModeButtons() {
    document.querySelectorAll("[data-viewmode]").forEach(b => {
      b.classList.toggle("btn-active", b.dataset.viewmode === state.viewMode);
    });
  }

  function renderAll() {
    renderGuideSidebar();
    renderHero();
    renderLensBar();
    renderViewport();
  }

  // Poll live GitHub state.json across all 6 therealwindycity archive repos so newly finished Actions runs appear live!
  async function hydrateLiveGitHubProgress() {
    for (const r of DB.archive_repos) {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${r.repo}/main/speaker-videos/state.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.processed) {
            Object.assign(state.livePublishedState, data.processed);
          }
        }
      } catch (_) {}
    }
    if (!isEmbed) renderGuideSidebar();
  }

  // Bind top-level controls
  if (!isEmbed) {
    populateFilters();
    document.querySelectorAll(".mode-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        if (state.mode === "ordinances" && !arcById[state.selectedId]) {
          state.selectedId = DB.ordinance_arcs[0].id;
        } else if (state.mode === "featured" && !richById[state.selectedId]) {
          state.selectedId = DB.rich_episodes[1].id;
        }
        syncModeButtons();
        renderAll();
      });
    });

    document.querySelectorAll("[data-viewmode]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.viewMode = btn.dataset.viewmode;
        syncViewModeButtons();
        renderLensBar();
        renderViewport();
      });
    });

    document.getElementById("searchInput").addEventListener("input", e => {
      state.search = e.target.value;
      if (state.search.trim().length > 2 && state.mode === "featured") {
        // Keep current mode unless zero hits
      }
      renderGuideSidebar();
    });

    document.getElementById("seasonFilter").addEventListener("change", e => {
      state.season = e.target.value;
      if (state.season !== "ALL" && state.season !== "2026") state.mode = "vault";
      syncModeButtons();
      renderGuideSidebar();
    });

    document.getElementById("typeFilter").addEventListener("change", e => {
      state.type = e.target.value;
      if (state.type === "Ordinance Story Arc") state.mode = "ordinances";
      syncModeButtons();
      renderGuideSidebar();
    });

    document.getElementById("speakerFilter").addEventListener("change", e => {
      state.speaker = e.target.value;
      state.mode = "featured";
      syncModeButtons();
      renderGuideSidebar();
    });

    document.getElementById("btnThemeSong").addEventListener("click", () => {
      if (isThemePlaying) stopThemeSong();
      else startThemeSong();
    });

    document.getElementById("btnPlayMontage").addEventListener("click", openIntroMontage);
    document.getElementById("btnCloseMontage").addEventListener("click", closeIntroMontage);
    document.getElementById("btnCloseInlinePlayer").addEventListener("click", () => {
      const vid = document.getElementById("inlineVideoEl");
      if (vid) vid.pause();
      const ifr = document.getElementById("inlineEmbedFallback");
      if (ifr) ifr.remove();
      document.getElementById("inlinePlayerDock").classList.remove("open");
    });

    window.addEventListener("keydown", e => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (state.viewMode === "swipe") {
        if (e.key === "ArrowRight") window._stepLens(1);
        if (e.key === "ArrowLeft") window._stepLens(-1);
      }
      if (e.key === "Escape") closeIntroMontage();
    });
  }

  renderAll();
  hydrateLiveGitHubProgress();
})();
