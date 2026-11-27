import Link from "next/link";
import EpisodeCard, { dateShort } from "@/components/EpisodeCard";
import { LENSES } from "@/lib/lens-meta";
import { getFeatured, getFeaturedContent, listEpisodes, listOrdinances, querySpeakerTurns, seasonSummary } from "@/lib/bundle";

export const dynamic = "force-dynamic";

function Row({ title, sub, href, children }: { title: string; sub?: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8">
      <div className="mb-3 flex items-end gap-3">
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
        {href && (
          <Link href={href} className="ml-auto text-xs font-bold text-amber-300 hover:underline">
            See all →
          </Link>
        )}
      </div>
      <div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto pb-2">{children}</div>
    </section>
  );
}

export default async function HomePage() {
  const [featured, fc, council, psc, finance, planning, ords, seasons, topTurns] = await Promise.all([
    getFeatured(),
    getFeaturedContent(),
    listEpisodes({ body: "council", season: 2026, limit: 14 }),
    listEpisodes({ body: "psc", season: 2026, limit: 10 }),
    listEpisodes({ body: "finance", season: 2026, limit: 10 }),
    listEpisodes({ body: "planning", limit: 10 }),
    listOrdinances({ limit: 10 }),
    seasonSummary(),
    querySpeakerTurns({ sort: "impact", limit: 10 }),
  ]);
  const ticker = ((fc?.scoreboard as { result: string; tally: string; label: string }[]) ?? []).map(
    (s) => `${s.result} · ${s.tally} · ${s.label.slice(0, 70)}`,
  );
  const total = seasons.reduce((n, s) => n + s.n, 0);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-600/35 via-[#0b1325] to-[#07090f]">
        <div className="scanlines pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1.45fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-amber-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" /> Featured meeting
            </div>
            <h1 className="title-shimmer mt-3 text-4xl font-black leading-[0.98] tracking-tight sm:text-6xl">{featured.title}</h1>
            <p className="mt-3 text-base text-slate-200">
              {featured.bodyName} · {dateShort(featured.date)}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{featured.logline}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href={`/episode/${featured.slug}`} className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-black hover:bg-amber-300">
                ▶ Watch this meeting
              </Link>
              <Link href="/speakers" className="rounded-full bg-[#1877F2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#166fe5]">
                🎙️ Speaker clips
              </Link>
              <Link href="/osint" className="rounded-full bg-emerald-500/25 px-4 py-2.5 text-sm font-bold text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/35">
                🕸️ Who&apos;s Who: people &amp; companies
              </Link>
              <Link href="/ordinances" className="rounded-full bg-violet-500/25 px-4 py-2.5 text-sm font-bold text-violet-100 ring-1 ring-violet-400/40 hover:bg-violet-500/35">
                📜 Ordinances: 1st reading to final vote
              </Link>
              <Link href="/documents" className="rounded-full bg-sky-500/20 px-4 py-2.5 text-sm font-bold text-sky-200 ring-1 ring-sky-400/40 hover:bg-sky-500/30">
                📄 Meeting documents
              </Link>
              <Link href="/provenance" className="rounded-full bg-rose-500/20 px-4 py-2.5 text-sm font-bold text-rose-200 ring-1 ring-rose-400/40 hover:bg-rose-500/30">
                🎥 Where the records come from
              </Link>
            </div>
            <p className="mt-4 max-w-2xl text-xs text-slate-400">
              {total.toLocaleString()} Cheyenne city meetings over {new Set(seasons.map((s) => s.season)).size} years (2008–2026), with meeting video from the Internet Archive, video clips of each speaker, profiles of the people and companies involved, and the original documents.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 self-center">
            {[
              [total.toLocaleString(), "City meetings, 2008–2026"],
              ["2,448", "Speaker video clips"],
              ["51", "People, companies & agencies in Who's Who"],
              ["6,339", "Minutes, agendas & attached documents"],
              ["275", "Ordinances followed from 1st to final reading"],
              ["14", "Screen recordings showing where the records come from"],
            ].map(([big, small]) => (
              <div key={big} className="rounded-xl bg-black/50 p-3.5 ring-1 ring-white/15">
                <div className="font-mono text-2xl font-black text-amber-300 sm:text-3xl">{big}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-slate-300">{small}</div>
              </div>
            ))}
          </div>
        </div>
        {ticker.length > 0 && (
          <div className="relative overflow-hidden border-y border-white/10 bg-red-700/90 py-1.5 text-xs font-bold uppercase tracking-wider">
            <div className="ticker-track">
              {[0, 1].map((k) => (
                <div key={k} className="flex shrink-0 gap-10 pr-10">
                  {ticker.map((t, i) => (
                    <span key={i}>■ {t}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Speaker video clips row */}
      <Row
        title="🎙️ Speaker Video Clips (3 minutes or less)"
        sub="who spoke, what role they spoke in, whether they were for or against, and how often they speak"
        href="/speakers"
      >
        {topTurns.rows.map((t) => (
          <Link
            key={t.id}
            href={`/speakers?speaker=${encodeURIComponent(t.speakerSlug)}`}
            className="flex h-52 w-80 shrink-0 snap-start flex-col justify-between rounded-xl border border-amber-400/25 bg-[#091122] p-4 hover:border-amber-400"
          >
            <div>
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase">
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-amber-200">
                  📼 {t.speakerAnalytics?.historicalClipCount ?? 1} clips of this speaker
                </span>
                <span className="font-mono text-emerald-300">
                  {Math.round(t.durationSec)}-second clip
                </span>
              </div>
              <div className="mt-1.5 text-sm font-black text-white">{t.speakerName}</div>
              <div className="text-[10px] font-semibold text-indigo-300">
                {t.speakingCapacity ?? t.speakerRole} · {t.stanceLabel ?? "Speaking"}
              </div>
              <div className="text-[11px] text-sky-300">
                {t.date} · {t.bodyName} [{t.hms}]
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-300">&ldquo;{t.text}&rdquo;</p>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Points of order: {t.speakerAnalytics?.pointOfOrderCount ?? 0}</span>
              <span className="font-bold text-amber-300">▶ Watch the clip →</span>
            </div>
          </Link>
        ))}
      </Row>

      <Row title="📜 Ordinances: 1st Reading to Final Vote" sub="follow each ordinance through every reading, with what speakers said and the documents" href="/ordinances">
        {ords.rows.map((o) => (
          <Link
            key={o.slug}
            href={`/ordinance/${o.slug}`}
            className="flex h-44 w-72 shrink-0 snap-start flex-col justify-between rounded-xl bg-gradient-to-br from-indigo-600/50 to-slate-900 p-4 ring-1 ring-white/10 hover:ring-amber-300/70"
          >
            <span className="w-fit rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {o.kind} · {o.readings.length} readings
            </span>
            <div className="line-clamp-3 text-sm font-bold leading-snug">{o.title}</div>
            <div className="text-[11px] text-amber-300">
              ▶ 1st reading {o.firstDate} → last {o.lastDate}
            </div>
          </Link>
        ))}
      </Row>

      <Row title="City Council · 2026" sub="most recent meetings" href="/episodes?body=council&season=2026">
        {council.rows.map((m) => (
          <EpisodeCard key={m.slug} m={m} />
        ))}
      </Row>
      <Row title="Public Services Committee" sub="where ordinances and zoning are discussed between council readings" href="/episodes?body=psc&season=2026">
        {psc.rows.map((m) => (
          <EpisodeCard key={m.slug} m={m} />
        ))}
      </Row>
      <Row title="Finance Committee" sub="spending, contracts, bids and audits" href="/episodes?body=finance&season=2026">
        {finance.rows.map((m) => (
          <EpisodeCard key={m.slug} m={m} />
        ))}
      </Row>
      <Row title="Planning Commission & Land Use" sub="subdivisions, annexations, planned developments and the city plan" href="/episodes?body=planning">
        {planning.rows.map((m) => (
          <EpisodeCard key={m.slug} m={m} />
        ))}
      </Row>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-xl font-black tracking-tight">{LENSES.length} Ways to Look at Every Meeting</h2>
        <p className="text-sm text-slate-400">
          Look at each meeting one view at a time, two side by side, all at once, or in windows you can drag around.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LENSES.map((l) => (
            <span key={l.key} title={l.blurb} className="rounded-full px-3 py-1.5 text-xs font-bold text-black" style={{ background: l.accent }}>
              {l.icon} {l.name}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
