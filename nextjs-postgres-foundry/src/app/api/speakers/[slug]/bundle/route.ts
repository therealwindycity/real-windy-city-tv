import fs from "node:fs";
import path from "node:path";
import { getSpeakerVault } from "@/lib/bundle";

export const dynamic = "force-dynamic";

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5978, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5978, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of centralParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocd, pos);
  return out;
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const vault = await getSpeakerVault(slug);
  if (!vault) return Response.json({ error: "Speaker not found" }, { status: 404 });

  const { profile, turns } = vault;
  const enc = new TextEncoder();
  const entries: { name: string; data: Uint8Array }[] = [];

  const an = profile.analytics;
  const mdLines = [
    `# ${profile.name} — Complete Cheyenne Civic Speaker Video & OSINT Archive`,
    `Role: ${profile.role}`,
    `Total Historical Clips: ${profile.turnCount} across ${profile.meetingCount} meetings (${profile.firstDate} -> ${profile.lastDate})`,
    `Average Speaking Time: ${an?.avgSpeakingFormatted ?? `${Math.round(profile.totalDurationSec / Math.max(1, profile.turnCount))}s`} | Total Floor Time: ${an?.totalSpeakingFormatted ?? `${Math.round(profile.totalDurationSec / 60)}m`}`,
    `Points of Order / Procedural Events: ${an?.pointOfOrderCount ?? 0}`,
    `Speaking Capacities: ${(an?.capacitiesBreakdown ?? []).map((c) => `${c.capacity} (${c.pct}%)`).join(" · ") || profile.role}`,
    `Top Topics Spoken On: ${(an?.topicAnalytics ?? []).map((t) => `${t.label} (${t.count})`).join(" · ") || profile.topThemes.join(", ")}`,
    `Lobbies For / Supports: ${(an?.lobbiesFor ?? []).join(" | ") || "N/A"}`,
    `Opposes / Challenges: ${(an?.opposes ?? []).join(" | ") || "N/A"}`,
    `Verified OSINT Links: ${(an?.osint?.profiles ?? []).map((p) => `${p.platform}: ${p.url}`).join(" | ")}`,
    ``,
    `## Branded C-SPAN Speaker-Only Clips & Ready-to-Post Facebook Captions (Strictly <= 3 Min Segments — Never Full Meeting)`,
    ``,
  ];

  const shLines = [
    `#!/usr/bin/env bash`,
    `# Strictly downloads/slices ONLY <=3-min speaker segments (NEVER full meeting videos!) for ${profile.name}`,
    `set -e`,
    `mkdir -p "${slug}_fb_clips"`,
    `cd "${slug}_fb_clips"`,
  ];

  for (const t of turns) {
    const durClamped = Math.min(180, Math.max(5, Math.round(t.durationSec)));
    const fbCaption = [
      `🎙️ ${profile.name} (${profile.role}) at Cheyenne ${t.bodyName} — ${t.date} [${t.hms}]`,
      `🏛️ Capacity: ${t.speakingCapacity ?? profile.role} · Stance: ${t.stanceLabel ?? "Floor Record"} · Archive: ${profile.turnCount} Historical Clips (Avg ${an?.avgSpeakingFormatted ?? "1m 30s"})`,
      `"${t.text.slice(0, 260)}${t.text.length > 260 ? "…" : ""}"`,
      t.ordinances.length ? `📜 Ordinance Reading: ${t.ordinances.map((o) => `${o.slug} (${o.stage})`).join(", ")}` : null,
      `🔗 All ${profile.turnCount} Historical Clips & OSINT Profile: https://therealwindycity.github.io/real-windy-city-tv/#/speakers/${slug}`,
      `#CheyenneWY #TheRealWindyCity #PublicRecord #WyomingCivicWatch #${t.themes[0] ?? "CityCouncil"}`,
    ]
      .filter(Boolean)
      .join("\n");

    mdLines.push(`### Turn #${t.id} — ${t.date} · ${t.bodyName} (${t.hms}, ${durClamped}s)`);
    mdLines.push(`- **Speaking Capacity**: ${t.speakingCapacity ?? profile.role}${t.representingOrg ? ` (${t.representingOrg})` : ""}`);
    mdLines.push(`- **Stance / Advocacy**: ${t.stanceLabel ?? "Floor Record"}${t.hasPointOfOrder ? ` · ⚠️ ${t.pointOfOrderType}` : ""}`);
    if (t.brandedMp4Url || t.directMp4Url || t.sourceMeetingMp4Url) {
      mdLines.push(`- **Branded C-SPAN Segment MP4**: ${t.brandedMp4Url ?? `/api/clips/${t.id}?download=1`}`);
    } else {
      mdLines.push(`- **Video**: transcript only — ${t.videoTimingNote ?? "no verified recording for this turn"}`);
    }
    if (t.videoTiming === "diarized_window") mdLines.push(`- **Note**: ${t.videoTimingNote}`);
    mdLines.push(`\n**Ready-to-Paste Facebook Post:**\n\`\`\`text\n${fbCaption}\n\`\`\`\n`);

    const fname = `RWC_${t.date}_${slug}_turn${String(t.id).padStart(4, "0")}_${durClamped}s.mp4`;
    if (t.brandedMp4Url) {
      shLines.push(`curl -L "${t.brandedMp4Url}" -o "${fname}"`);
    } else if (t.directMp4Url && t.directMp4Url.startsWith("https://raw.githubusercontent.com/")) {
      shLines.push(`curl -L "${t.directMp4Url}" -o "${fname}"`);
    } else if (t.sourceMeetingMp4Url && t.sourceMeetingMp4Url.includes("archive.org/download/")) {
      shLines.push(`ffmpeg -y -ss ${t.startSec} -t ${durClamped} -i "${t.sourceMeetingMp4Url}" -c:v libx264 -c:a aac "${fname}"`);
    } else if (t.youtubeId) {
      shLines.push(`yt-dlp --download-sections "*${Math.floor(t.startSec)}-${Math.floor(t.startSec) + durClamped}" -f "mp4" "https://www.youtube.com/watch?v=${t.youtubeId}" -o "${fname}"`);
    }
  }

  entries.push({ name: `${slug}/SPEAKER_DOSSIER_OSINT_AND_FB_CAPTIONS.md`, data: enc.encode(mdLines.join("\n")) });
  entries.push({ name: `${slug}/turns_manifest.json`, data: enc.encode(JSON.stringify({ profile, turns }, null, 2)) });
  entries.push({ name: `${slug}/download_speaker_only_segments.sh`, data: enc.encode(shLines.join("\n") + "\n") });

  // Bundle locally rendered C-SPAN branded MP4 clips for this speaker right inside the ZIP!
  const renderedDir = path.join(process.cwd(), "public", "rendered-clips");
  let bundledCount = 0;
  for (const t of turns) {
    if (bundledCount >= 5) break;
    const localMp4 = path.join(renderedDir, `rwc-turn-${t.id}.mp4`);
    if (fs.existsSync(localMp4)) {
      const st = fs.statSync(localMp4);
      if (st.size > 50_000 && st.size < 15_000_000) {
        entries.push({
          name: `${slug}/cspan_branded_mp4_clips/RWC_${t.date}_turn${t.id}_${Math.round(t.durationSec)}s.mp4`,
          data: new Uint8Array(fs.readFileSync(localMp4)),
        });
        bundledCount++;
      }
    }
  }

  // Fetch up to 6 direct standalone MP4 clips (<8MB each) directly into the .zip so user gets instant MP4s!
  const directTurns = turns.filter((t) => t.directMp4Url && t.directMp4Url.startsWith("https://raw.githubusercontent.com/")).slice(0, 6);
  for (const dt of directTurns) {
    try {
      const resp = await fetch(dt.directMp4Url!, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        if (ab.byteLength > 0 && ab.byteLength < 12_000_000) {
          entries.push({
            name: `${slug}/mp4_clips/${dt.date}_turn${dt.id}_${Math.round(dt.durationSec)}s.mp4`,
            data: new Uint8Array(ab),
          });
        }
      }
    } catch {
      // Keep manifest entry if fetch times out
    }
  }

  const zipBytes = buildZip(entries);
  return new Response(Buffer.from(zipBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-cheyenne-speaker-clips.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
