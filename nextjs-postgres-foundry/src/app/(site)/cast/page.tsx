import Link from "next/link";
import { getCast, getFeatured } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export default async function CastPage() {
  const [cast, featured] = await Promise.all([getCast(), getFeatured()]);
  const maxD = Math.max(1, ...cast.map((c) => c.dissents));
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">The recurring cast</h1>
      <p className="text-sm text-slate-400">Taken from the roll call of every official minutes document in the dataset. &ldquo;No votes&rdquo; is counted by this app&rsquo;s parser over those minutes; it only sees recorded motions with an explicit &ldquo;Voting no&rdquo; clause.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {cast.map((c) => (
          <div key={c.id} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-lg font-black">{c.name.slice(0, 1)}</div>
              <div>
                <div className="font-black">{c.honorific} {c.name}</div>
                <div className="text-[11px] uppercase tracking-widest text-violet-300">{c.role}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300">Present in {c.meetingsPresent} episodes with minutes</div>
            {c.role === "Council Member" || c.role === "Mayor" ? (
              <div className="mt-2 grid grid-cols-[70px_1fr_24px] items-center gap-2 text-xs">
                <span className="text-slate-400">No votes</span>
                <div className="h-2 rounded bg-slate-800"><div className="h-2 rounded bg-rose-400" style={{ width: `${(c.dissents / maxD) * 100}%` }} /></div>
                <span className="text-right tabular-nums">{c.dissents}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-400">See the full billing for the latest episode: <Link className="text-amber-300 underline" href={`/episode/${featured.slug}`}>{featured.title}</Link>.</p>
    </div>
  );
}
