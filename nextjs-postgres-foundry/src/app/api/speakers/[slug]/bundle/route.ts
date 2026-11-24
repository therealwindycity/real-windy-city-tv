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

  const mdLines = [
    `# ${profile.name} — Complete Cheyenne Civic Speaker Video Archive`,
    `Role: ${profile.role}`,
    `Total Recorded Turns: ${profile.turnCount} across ${profile.meetingCount} meetings (${profile.firstDate} -> ${profile.lastDate})`,
    `Total Speaking Time: ${Math.round(profile.totalDurationSec / 60)} minutes`,
    `Top Civic Themes: ${profile.topThemes.join(", ")}`,
    ``,
    `## Facebook-Ready Clip Captions & Direct Video Links`,
    ``,
  ];

  const shLines = [
    `#!/usr/bin/env bash`,
    `# Auto-downloads/slices all <=3-min video turns for ${profile.name} ready for Facebook upload`,
    `set -e`,
    `mkdir -p "${slug}_fb_clips"`,
    `cd "${slug}_fb_clips"`,
  ];

  for (const t of turns) {
    const fbCaption = [
      `🎙️ ${profile.name} (${profile.role}) at Cheyenne ${t.bodyName} — ${t.date} [${t.hms}]`,
      `"${t.text.slice(0, 260)}${t.text.length > 260 ? "…" : ""}"`,
      t.ordinances.length ? `📜 Ordinance Reading: ${t.ordinances.map((o) => `${o.slug} (${o.stage})`).join(", ")}` : null,
      `🔗 Full Verified Public Record & Multi-Lens Episode: https://therealwindycity.github.io/real-windy-city-tv/#ep=${t.meetingSlug}`,
      `#CheyenneWY #TheRealWindyCity #PublicRecord #WyomingCivicWatch #${t.themes[0] ?? "CityCouncil"}`,
    ]
      .filter(Boolean)
      .join("\n");

    mdLines.push(`### Turn #${t.id} — ${t.date} · ${t.bodyName} (${t.hms}, ${Math.round(t.durationSec)}s)`);
    mdLines.push(`- **Emotion / Register**: ${t.emotion.toUpperCase()} (Impact ${t.impactScore}/99)`);
    mdLines.push(`- **Themes**: ${t.themes.join(", ")}`);
    if (t.directMp4Url) mdLines.push(`- **Direct MP4 Video**: ${t.directMp4Url}`);
    if (t.speakerZipUrl) mdLines.push(`- **Meeting Speaker .ZIP**: ${t.speakerZipUrl}`);
    if (t.embedUrl) mdLines.push(`- **Timestamped Stream**: ${t.embedUrl}`);
    mdLines.push(`\n**Ready-to-Paste Facebook Post:**\n\`\`\`text\n${fbCaption}\n\`\`\`\n`);

    const fname = `${t.date}_${slug}_turn${String(t.id).padStart(4, "0")}_${Math.round(t.durationSec)}s.mp4`;
    if (t.directMp4Url && t.directMp4Url.endsWith(".mp4")) {
      shLines.push(`curl -L "${t.directMp4Url}" -o "${fname}"`);
    } else if (t.youtubeId) {
      shLines.push(`yt-dlp --download-sections "*${Math.floor(t.startSec)}-${Math.ceil(t.endSec)}" -f "mp4" "https://www.youtube.com/watch?v=${t.youtubeId}" -o "${fname}"`);
    }
  }

  entries.push({ name: `${slug}/SPEAKER_DOSSIER_AND_FB_CAPTIONS.md`, data: enc.encode(mdLines.join("\n")) });
  entries.push({ name: `${slug}/turns_manifest.json`, data: enc.encode(JSON.stringify({ profile, turns }, null, 2)) });
  entries.push({ name: `${slug}/download_all_fb_mp4_clips.sh`, data: enc.encode(shLines.join("\n") + "\n") });

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
