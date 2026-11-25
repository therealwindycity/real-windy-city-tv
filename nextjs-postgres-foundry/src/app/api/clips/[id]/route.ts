import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { speakerTurns } from "@/db/schema";
import { eq } from "drizzle-orm";

const execFileAsync = promisify(execFile);
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const turnId = Number(id);
  if (!Number.isInteger(turnId) || turnId <= 0) {
    return Response.json({ error: "Invalid speaker turn ID" }, { status: 400 });
  }

  await ensureSeeded();
  const rows = await db.select().from(speakerTurns).where(eq(speakerTurns.id, turnId)).limit(1);
  const turn = rows[0];
  if (!turn) {
    return Response.json({ error: "Speaker turn not found" }, { status: 404 });
  }

  if (!turn.brandedMp4Url && !turn.directMp4Url && !turn.sourceMeetingMp4Url) {
    return Response.json(
      { error: "No verified video for this speaker turn (transcript only)", detail: turn.videoTimingNote ?? null },
      { status: 409 },
    );
  }

  const clipDir = path.join(process.cwd(), "public", "rendered-clips");
  const clipPath = path.join(clipDir, `rwc-turn-${turnId}.mp4`);

  if (!fs.existsSync(clipPath) || fs.statSync(clipPath).size < 50_000) {
    const scriptPath = path.join(process.cwd(), "scripts", "render_branded_clip.py");
    try {
      await execFileAsync("python3", [scriptPath, String(turnId), clipPath], {
        cwd: process.cwd(),
        timeout: 120_000,
      });
    } catch (err) {
      return Response.json(
        { error: "Failed to render branded C-SPAN speaker segment", detail: String(err) },
        { status: 500 },
      );
    }
  }

  const stat = fs.statSync(clipPath);
  const url = new URL(req.url);
  const wantDownload = url.searchParams.get("download") === "1";
  const safeSlug = turn.speakerSlug.replace(/[^a-z0-9-]/gi, "-");
  const dlName = `RWC_${turn.date}_${safeSlug}_turn${turnId}_cspan_segment.mp4`;
  const disposition = wantDownload ? `attachment; filename="${dlName}"` : `inline; filename="${dlName}"`;

  const range = req.headers.get("range");
  if (range && !wantDownload) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? Math.min(stat.size - 1, parseInt(m[2], 10)) : stat.size - 1;
      if (start < stat.size && start <= end) {
        const buf = Buffer.alloc(end - start + 1);
        const fd = fs.openSync(clipPath, "r");
        fs.readSync(fd, buf, 0, buf.length, start);
        fs.closeSync(fd);
        return new Response(buf, {
          status: 206,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(buf.length),
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Disposition": disposition,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }
  }

  const fullBuf = fs.readFileSync(clipPath);
  return new Response(fullBuf, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": disposition,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
