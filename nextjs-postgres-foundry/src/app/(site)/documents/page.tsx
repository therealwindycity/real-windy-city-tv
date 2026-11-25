import Link from "next/link";
import InstantFilterForm from "@/components/InstantFilterForm";
import { listFoundryDocuments } from "@/lib/bundle";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function DocumentsVaultPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; ocr?: string; season?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { rows, total } = await listFoundryDocuments({
    q: sp.q,
    role: sp.role,
    ocrOnly: sp.ocr === "1",
    season: sp.season ? Number(sp.season) : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, role: sp.role, ocr: sp.ocr, season: sp.season, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/documents${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="rounded-2xl border border-sky-500/30 bg-[#07101f] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-sky-400">
              PALANTIR FOUNDRY // GLOBAL AGENDAS &amp; SUPPORTING DOCUMENTS VAULT
            </div>
            <h1 className="mt-1 text-3xl font-black text-white">
              6,371 Primary Municipal Documents &amp; SHA-1 OCR Packets (2008–2026)
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-300">
              Every City of Cheyenne Agenda, Supporting Document PDF (<code>cheyenne-archives-*</code>), Staff Report, Ordinance Substitute, Bid Tabulation, and Clerk Minute — lexically reconciled and cross-linked to its parent episode and provenance video.
            </p>
          </div>
          <Link href="/provenance" className="rounded-xl bg-rose-500/20 px-4 py-2.5 text-xs font-bold text-rose-200 ring-1 ring-rose-400/40 hover:bg-rose-500/30">
            🎥 Watch Manual Click-Path Provenance Videos →
          </Link>
        </div>

        <InstantFilterForm action="/documents" className="mt-4 flex flex-wrap gap-2 text-xs">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search PDF titles, ordinances, SHA-1 hashes, dates…"
            className="w-80 rounded-lg border border-slate-700 bg-[#040811] px-3 py-2 font-mono text-white outline-none focus:border-sky-400"
          />
          <button type="submit" className="rounded-lg bg-sky-400 px-4 py-2 font-mono font-black text-black hover:bg-sky-300">
            Enter ↵
          </button>
          <select name="role" defaultValue={sp.role ?? ""} className="rounded-lg border border-slate-700 bg-[#040811] px-3 py-2 font-mono text-white">
            <option value="">ROLE: ALL (6,371)</option>
            <option value="attachment">SUPPORTING PDFs</option>
            <option value="agenda">OFFICIAL AGENDAS</option>
            <option value="minutes">MINUTES &amp; TRANSCRIPTS</option>
            <option value="staff_report">STAFF REPORTS</option>
          </select>
          <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#040811] px-3 py-2 font-mono text-emerald-300">
            <input type="checkbox" name="ocr" value="1" defaultChecked={sp.ocr === "1"} />
            SHA-1 AI-Record-OCR Only (1,081)
          </label>
          {(sp.q || sp.role || sp.ocr) && (
            <Link href="/documents" className="rounded-lg bg-white/10 px-3 py-2 font-mono text-slate-300 hover:bg-white/20">
              RESET
            </Link>
          )}
        </InstantFilterForm>
      </div>

      <div className="font-mono text-xs text-slate-400">
        MATCHED_OBJECTS={total.toLocaleString()} · PAGE {page} OF {totalPages}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#060b16]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-[#091224] font-mono text-[10px] uppercase text-slate-400">
            <tr>
              <th className="p-3">Date / Body</th>
              <th className="p-3">Role</th>
              <th className="p-3">Document / Supporting PDF Title</th>
              <th className="p-3">SHA-1 / OCR</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-sky-500/5">
                <td className="whitespace-nowrap p-3 font-mono text-[11px]">
                  <Link href={`/episode/${d.meetingSlug}`} className="font-bold text-sky-300 hover:underline">
                    {d.date}
                  </Link>
                  <div className="text-[10px] text-slate-400">{d.bodyName}</div>
                </td>
                <td className="p-3 font-mono text-[10px]">
                  <span className="rounded bg-slate-800 px-2 py-0.5 uppercase text-sky-200">{d.role}</span>
                </td>
                <td className="p-3">
                  <div className="font-semibold text-slate-100">{d.title}</div>
                  <div className="text-[11px] text-slate-400">Episode: {d.episodeTitle}</div>
                </td>
                <td className="p-3 font-mono text-[10px]">
                  {d.ocr && <span className="mr-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">🔬OCR</span>}
                  {d.sha1 ? <span className="text-slate-400">{d.sha1.slice(0, 12)}…</span> : <span className="text-slate-600">WAYBACK</span>}
                </td>
                <td className="whitespace-nowrap p-3 text-xs">
                  <div className="flex gap-2">
                    <Link
                      href={`/episode/${d.meetingSlug}#lenses`}
                      className="rounded bg-sky-500/20 px-2.5 py-1 font-mono text-[11px] font-bold text-sky-200 hover:bg-sky-500/30"
                    >
                      Foundry Lens
                    </Link>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-amber-400/20 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-200 hover:bg-amber-400/30"
                      >
                        PDF ↗
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#080f1d] px-4 py-3 text-xs">
        {page > 1 ? (
          <Link href={qs({ page: String(page - 1) })} className="rounded-lg bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20">
            ← Previous Page
          </Link>
        ) : (
          <span className="rounded-lg bg-white/5 px-4 py-2 text-slate-500">← Previous Page</span>
        )}
        <span className="font-mono text-slate-300">
          Page {page} of {totalPages} ({total.toLocaleString()} documents)
        </span>
        {page < totalPages ? (
          <Link href={qs({ page: String(page + 1) })} className="rounded-lg bg-sky-400 px-4 py-2 font-black text-black hover:bg-sky-300">
            Next Page →
          </Link>
        ) : (
          <span className="rounded-lg bg-white/5 px-4 py-2 text-slate-500">Next Page →</span>
        )}
      </div>
    </div>
  );
}
