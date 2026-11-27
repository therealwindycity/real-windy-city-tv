"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeBundle } from "@/lib/types";
import { SEV_LABEL, flagLabel, type LensKey } from "@/lib/lens-meta";
import { EpisodeSpeakersLens, FoundryLensView, GothamGraphLensView, ProvenanceFilmsWorkbench } from "@/components/GothamFoundrySuite";

type B = { b: EpisodeBundle };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const Tag = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) => {
  const tones: Record<string, string> = {
    slate: "bg-slate-700/60 text-slate-100",
    red: "bg-red-600/80 text-white",
    green: "bg-emerald-600/80 text-white",
    amber: "bg-amber-500/90 text-black",
    blue: "bg-sky-600/80 text-white",
    violet: "bg-violet-600/80 text-white",
    outline: "border border-current bg-transparent",
  };
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone] ?? tones.slate}`}>{children}</span>;
};
const Note = ({ children }: { children: React.ReactNode }) => <p className="rounded border border-dashed border-current/30 p-2 text-xs opacity-80">{children}</p>;

/* ------------------------------------------------------------ STORY */
function Story({ b }: B) {
  const [depth, setDepth] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const L = b.lenses.layman;
  const levels = ["Headline", "Brief", "Deep", "Kid mode"];
  const text = depth === 0 ? [L.headline] : depth === 1 ? [L.headline, ...L.brief] : depth === 2 ? [L.headline, ...L.brief, ...L.deep] : [L.kids];
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const toggle = () => {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text.join(" "));
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  return (
    <div className="min-h-full bg-gradient-to-b from-amber-50 to-orange-100 p-5 text-stone-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-800">How much detail</span>
          {levels.map((l, i) => (
            <button key={l} onClick={() => setDepth(i)} className={`rounded-full px-3 py-1 text-xs font-semibold ${depth === i ? "bg-stone-900 text-amber-100" : "bg-white/70 text-stone-700 hover:bg-white"}`}>
              {l}
            </button>
          ))}
          <button onClick={toggle} className="ml-auto rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black hover:bg-amber-400">
            {speaking ? "■ Stop" : "🔊 Read aloud"}
          </button>
        </div>
        <h2 className="font-serif text-2xl font-bold leading-snug sm:text-3xl">{text[0]}</h2>
        <div className="mt-4 space-y-4 font-serif text-lg leading-relaxed text-stone-800">
          {text.slice(1).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-6">
          <Note>
            {b.lenses.authored
              ? "Hand-written from the agenda packet and the watchdog debrief. Quoted items are labeled in the Fact-Check Desk."
              : "Written automatically from the agenda titles, recommended actions and minutes. It adds nothing that isn&apos;t in those records."}
          </Note>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- TABLOID */
function Tabloid({ b }: B) {
  const T = b.lenses.tabloid;
  return (
    <div className="min-h-full bg-[#f4efe1] p-4 text-black" style={{ backgroundImage: "radial-gradient(#00000010 1px, transparent 1px)", backgroundSize: "6px 6px" }}>
      <div className="mx-auto max-w-4xl">
        <div className="border-y-4 border-double border-black py-2 text-center">
          <div className="font-serif text-4xl font-black tracking-tight sm:text-6xl">{T.masthead}</div>
          <div className="text-[11px] font-bold uppercase tracking-[0.3em]">{T.slogan} · {b.meeting.date}</div>
        </div>
        <div className="my-4 bg-red-700 px-3 py-4 text-center font-serif text-3xl font-black uppercase leading-none text-white sm:text-5xl">{T.banner}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {T.stories.map((s, i) => (
            <article key={i} className="border-t-2 border-black pt-2">
              <h3 className="font-serif text-xl font-black uppercase leading-tight">{s.headline}</h3>
              <p className="mt-1 text-sm font-bold italic">{s.deck}</p>
              <p className="mt-2 font-serif text-sm leading-snug">{s.body}</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-red-800">Receipts: {s.receipts}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-[11px] italic">Headline voice only. Every line points to a source row; where it came from the watchdog debrief and not the official minutes, the receipts line says so.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ LEGAL */
function Legal({ b }: B) {
  const [open, setOpen] = useState<string | null>(b.lenses.legal.issues[0]?.id ?? null);
  return (
    <div className="min-h-full bg-[#faf6ec] p-5 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="rounded border-l-4 border-violet-700 bg-violet-50 p-3 text-xs text-violet-900">{b.lenses.legal.disclaimer}</p>
        {b.lenses.legal.issues.map((i) => (
          <div key={i.id} className="rounded-lg border border-stone-300 bg-white shadow-sm">
            <button onClick={() => setOpen(open === i.id ? null : i.id)} className="flex w-full items-start gap-3 p-3 text-left">
              <span className="mt-0.5 rounded bg-violet-700 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">ISSUE</span>
              <span className="font-serif text-base font-bold">{i.question}</span>
              <span className="ml-auto text-stone-400">{open === i.id ? "−" : "+"}</span>
            </button>
            {open === i.id && (
              <div className="space-y-3 border-t border-stone-200 p-3 text-sm leading-relaxed">
                {([["RULE", i.rule], ["APPLICATION", i.application], ["CONCLUSION", i.conclusion]] as const).map(([k, v]) => (
                  <div key={k} className="grid gap-1 sm:grid-cols-[110px_1fr]">
                    <span className="font-mono text-[11px] font-bold tracking-widest text-violet-800">{k}</span>
                    <p>{v}</p>
                  </div>
                ))}
                {i.cites.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {i.cites.map((c) => (
                      <span key={c} className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-700">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- TRANSCRIPT */
function DocReader({ id }: { id: number }) {
  const [txt, setTxt] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then((j) => live && setTxt(j.body ?? ""))
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, [id]);
  if (err) return <p className="text-xs text-red-400">Could not load document.</p>;
  if (txt === null) return <p className="text-xs text-zinc-400">Loading…</p>;
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">{txt || "No extractable text (scanned?)."}</pre>;
}

function Transcript({ b }: B) {
  const [q, setQ] = useState("");
  const [tPage, setTPage] = useState(1);
  const [openDoc, setOpenDoc] = useState<number | null>(null);
  const paras = useMemo(() => (b.minutesText ?? "").split(/\n\s*\n/).filter(Boolean), [b.minutesText]);
  const hits = q ? paras.filter((p) => p.toLowerCase().includes(q.toLowerCase())) : paras;
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(hits.length / pageSize));
  const pagedHits = hits.slice((tPage - 1) * pageSize, tPage * pageSize);
  const textDocs = b.docs.filter((d) => d.hasText && d.role === "attachment");
  const hl = (p: string) => {
    if (!q) return p;
    const parts = p.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
    return parts.map((s, i) => (s.toLowerCase() === q.toLowerCase() ? <mark key={i} className="bg-amber-300 text-black">{s}</mark> : s));
  };
  return (
    <div className="min-h-full bg-zinc-950 p-4 font-mono text-zinc-200">
      <div className="mx-auto max-w-3xl space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTPage(1);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTPage(1);
            }}
            placeholder="Search the cleaned official minutes record…"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
          />
          <button type="submit" className="rounded bg-amber-400 px-3.5 py-1.5 text-xs font-black text-black hover:bg-amber-300">
            Enter ↵
          </button>
          <span className="text-[11px] text-zinc-400">{b.analytics.minutesWords ? `${b.analytics.minutesWords.toLocaleString()} words · ${hits.length}/${paras.length} paragraphs` : "no minutes text"}</span>
        </form>
        {b.minutesText ? (
          <div className="space-y-3 text-[13px] leading-relaxed">
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Official minutes from the City Clerk</div>
            {pagedHits.map((p, i) => (
              <p key={i} className="border-l-2 border-zinc-700 pl-3">{hl(p)}</p>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">
                <button type="button" disabled={tPage <= 1} onClick={() => setTPage((p) => Math.max(1, p - 1))} className="rounded bg-zinc-800 px-3 py-1 font-bold disabled:opacity-40">
                  ← Previous Page
                </button>
                <span>Page {tPage} of {totalPages}</span>
                <button type="button" disabled={tPage >= totalPages} onClick={() => setTPage((p) => Math.min(totalPages, p + 1))} className="rounded bg-amber-400 px-3 py-1 font-black text-black disabled:opacity-40">
                  Next Page →
                </button>
              </div>
            )}
          </div>
        ) : (
          <Note>
            We don&apos;t have the text of the official minutes for this meeting{b.meeting.phase === "upcoming" ? " (the meeting had not happened yet when we collected the records)" : ""}. {b.meeting.minutesUrl ? "There is a link to the minutes. Open it in the Source Files view." : "The city meeting list has no minutes link."}
          </Note>
        )}
        {textDocs.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Attached documents — their text ({textDocs.length})</div>
            {textDocs.map((d) => (
              <div key={d.id} className="rounded border border-zinc-800 bg-zinc-900/60">
                <button onClick={() => setOpenDoc(openDoc === d.id ? null : d.id)} className="flex w-full items-center gap-2 p-2 text-left text-xs">
                  <Tag tone="blue">item {d.itemNo || "—"}</Tag>
                  <span className="truncate">{d.title}</span>
                  <span className="ml-auto shrink-0 text-zinc-500">{d.pages}p · {d.words?.toLocaleString()}w</span>
                </button>
                {openDoc === d.id && <div className="p-2 pt-0"><DocReader id={d.id} /></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- ANALYTICS */
const Bar = ({ label, n, max, color = "#38bdf8" }: { label: string; n: number; max: number; color?: string }) => (
  <div className="grid grid-cols-[130px_1fr_40px] items-center gap-2 text-xs">
    <span className="truncate text-slate-300">{label}</span>
    <div className="h-3 rounded bg-slate-800"><div className="h-3 rounded" style={{ width: `${max ? (n / max) * 100 : 0}%`, background: color }} /></div>
    <span className="text-right tabular-nums text-slate-400">{n}</span>
  </div>
);
function Analytics({ b }: B) {
  const a = b.analytics;
  const maxKind = Math.max(1, ...a.byKind.map((k) => k.n));
  const tiles: [string, string][] = [
    ["Agenda items", String(a.itemCount)],
    ["Substantive", String(a.substantive)],
    ["On consent", String(a.consentCount)],
    ["Recorded votes", String(a.votes.total)],
    ["Unanimous", String(a.votes.unanimous)],
    ["Failed", String(a.votes.failed)],
    ["Attachments", String(a.docs.n)],
    ["Pages", a.docs.pages.toLocaleString()],
  ];
  const maxPeer = Math.max(1, a.itemCount, ...a.peers.map((p) => p.items));
  return (
    <div className="min-h-full bg-slate-950 p-5 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-900 p-3 ring-1 ring-slate-800">
              <div className="text-2xl font-black tabular-nums text-sky-300">{v}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{k}</div>
            </div>
          ))}
        </div>
        <section className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-sky-300">Kinds of agenda items</h3>
          {a.byKind.length ? a.byKind.map((k) => <Bar key={k.kind} label={k.kind} n={k.n} max={maxKind} />) : <Note>The agenda for this meeting hasn&apos;t been broken out item by item.</Note>}
        </section>
        {a.sponsors.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-violet-300">Who brought the most items</h3>
            {a.sponsors.map((s) => <Bar key={s.name} label={s.name.toLowerCase()} n={s.n} max={a.sponsors[0].n} color="#a78bfa" />)}
          </section>
        )}
        <section className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-rose-300">Automatic warnings</h3>
          {a.flags.some((f) => f.n) ? a.flags.map((f) => <Bar key={f.sev} label={SEV_LABEL[f.sev] ?? f.sev} n={f.n} max={Math.max(1, ...a.flags.map((x) => x.n))} color={f.sev === "HIGH" ? "#f43f5e" : f.sev === "MED" ? "#f59e0b" : "#64748b"} />) : <Note>No automatic warnings for this meeting.</Note>}
        </section>
        <section className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300">Versus the previous {a.peers.length} {b.meeting.bodyName} meetings (agenda items)</h3>
          <Bar label="This meeting" n={a.itemCount} max={maxPeer} color="#34d399" />
          {a.peers.map((p) => <Bar key={p.slug} label={p.date} n={p.items} max={maxPeer} color="#475569" />)}
        </section>
        <p className="text-[11px] text-slate-500">Counts come from the Granicus agenda items and the parsed minutes. The parser keys on the Council minutes phrasing; committee minutes may under-count votes.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ VOTES */
function Votes({ b }: B) {
  const sb = b.lenses.scoreboard;
  const tone = (r: string) => (/PASS|APPROV|ADOPT/.test(r) ? "green" : /FAIL/.test(r) ? "red" : "amber");
  const maxD = Math.max(1, ...b.analytics.dissent.map((d) => d.n));
  return (
    <div className="min-h-full bg-emerald-950 p-5 text-emerald-50">
      <div className="mx-auto max-w-3xl space-y-5">
        {sb.length > 0 ? (
          <>
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300">Results, as reported by local watchdogs</h3>
            <div className="space-y-2">
              {sb.map((s, i) => (
                <div key={i} className="rounded-lg bg-emerald-900/50 p-3 ring-1 ring-emerald-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone={tone(s.result)}>{s.result}</Tag>
                    <span className="text-xs text-emerald-200">items {s.items.join(", ")}</span>
                    <Tag tone={s.conf === "low" ? "red" : "outline"}>{s.conf} confidence</Tag>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-emerald-200">{s.tally}</p>
                  {s.no.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{s.no.map((n) => <span key={n} className="rounded bg-rose-700/70 px-1.5 py-0.5 text-[11px]">no · {n}</span>)}</div>}
                  {s.note && <p className="mt-1 text-[11px] text-emerald-300/80">{s.note}</p>}
                </div>
              ))}
            </div>
          </>
        ) : null}
        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300">Recorded motions in the official minutes ({b.voteEvents.length})</h3>
        {b.voteEvents.length === 0 && <Note>No recorded votes for this meeting.</Note>}
        <div className="space-y-2">
          {b.voteEvents.map((v) => (
            <div key={v.idx} className="rounded bg-emerald-900/40 p-2 text-xs ring-1 ring-emerald-900">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Tag tone={v.result === "failed" ? "red" : v.unanimous ? "green" : "amber"}>{v.result === "failed" ? "failed" : v.unanimous ? "unanimous" : "recorded"}</Tag>
                {v.noNames.map((n) => <span key={n} className="rounded bg-rose-700/70 px-1.5 py-0.5 text-[10px]">no · {n}</span>)}
              </div>
              <p className="leading-snug text-emerald-100/90">{v.excerpt.slice(0, 340)}{v.excerpt.length > 340 ? "…" : ""}</p>
            </div>
          ))}
        </div>
        {b.analytics.dissent.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-300">Members who voted no at this meeting</h3>
            {b.analytics.dissent.map((d) => <Bar key={d.name} label={d.name} n={d.n} max={maxD} color="#fb7185" />)}
          </section>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- MAP */
function MapLens({ b }: B) {
  const m = b.lenses.map;
  const [sel, setSel] = useState<string | null>(m?.parcels[0]?.id ?? null);
  const [live, setLive] = useState(false);
  const tones: Record<string, string> = { amber: "#f59e0b", teal: "#14b8a6", rose: "#fb7185", violet: "#a78bfa" };
  const parcel = m?.parcels.find((p) => p.id === sel);
  return (
    <div className="min-h-full bg-slate-900 p-4 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-3">
        {m ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setLive(false)} className={`rounded-full px-3 py-1 text-xs font-bold ${!live ? "bg-teal-400 text-black" : "bg-slate-800"}`}>Schematic</button>
              <button onClick={() => setLive(true)} className={`rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-teal-400 text-black" : "bg-slate-800"}`}>Live street map</button>
              <span className="text-[11px] text-slate-400">{live ? "OpenStreetMap, centered on Cheyenne (needs network)." : m.note}</span>
            </div>
            {live ? (
              <iframe title="OpenStreetMap Cheyenne" className="h-[420px] w-full rounded-lg border border-slate-700" src="https://www.openstreetmap.org/export/embed.html?bbox=-105.05%2C41.03%2C-104.60%2C41.25&layer=mapnik" />
            ) : (
              <svg viewBox="0 0 1000 640" className="w-full rounded-lg bg-slate-950 ring-1 ring-slate-700">
                <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1e293b" strokeWidth="1" /></pattern></defs>
                <rect width="1000" height="640" fill="url(#g)" />
                {m.roads.map((r) => (
                  <path key={r.id} d={r.d} stroke="#475569" strokeWidth={r.w} fill="none" strokeLinecap="round" />
                ))}
                {m.roads.map((r) => {
                  const nums = r.d.match(/-?\d+/g)!.map(Number);
                  return <text key={r.id + "t"} x={nums[0] + 6} y={nums[1] + 16} fontSize="12" fill="#94a3b8">{r.label}</text>;
                })}
                {m.parcels.map((p) => (
                  <g key={p.id} onClick={() => setSel(p.id)} className="cursor-pointer">
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="10" fill={tones[p.tone] ?? "#94a3b8"} fillOpacity={sel === p.id ? 0.6 : 0.28} stroke={tones[p.tone]} strokeWidth={sel === p.id ? 4 : 2} />
                    <text x={p.x + 8} y={p.y + 22} fontSize="14" fontWeight="800" fill="#fff">{p.label}</text>
                  </g>
                ))}
              </svg>
            )}
            {parcel && (
              <div className="rounded-lg bg-slate-800 p-3 text-sm">
                <div className="font-bold" style={{ color: tones[parcel.tone] }}>{parcel.label}</div>
                <p className="text-slate-300">{parcel.sub}</p>
                <p className="mt-1 text-xs text-slate-400">Agenda items: {parcel.items.join(", ")}</p>
              </div>
            )}
          </>
        ) : (
          <Note>There is no hand-drawn map for this meeting. Locations pulled from the agenda&rsquo;s legal descriptions are listed below with street-map links.</Note>
        )}
        <h3 className="pt-2 text-xs font-bold uppercase tracking-widest text-teal-300">Locations named in agenda titles ({b.lenses.locations.length})</h3>
        <ul className="space-y-1.5 text-sm">
          {b.lenses.locations.map((l, i) => (
            <li key={i} className="flex gap-2 rounded bg-slate-800/70 p-2"><span>📍</span><span className="flex-1">{l.text}</span><a className="shrink-0 text-xs text-teal-300 underline" href={l.osm} target="_blank" rel="noreferrer">find on map</a></li>
          ))}
          {b.lenses.locations.length === 0 && <li className="text-xs text-slate-400">No location descriptions in this meeting&rsquo;s item titles.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- HISTORY */
function History({ b }: B) {
  const L = b.lenses;
  const stageTone = (s: string) => (s === "first" ? "blue" : s === "second" ? "amber" : s === "third" ? "green" : "slate");
  return (
    <div className="min-h-full bg-orange-50 p-5 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-6">
        {L.coxTimeline.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-800">Cox Ranch — the story so far (watchdog timeline)</h3>
            <ol className="relative space-y-3 border-l-2 border-orange-300 pl-4">
              {L.coxTimeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-orange-500" />
                  <div className="font-mono text-xs font-bold text-orange-700">{t.date}</div>
                  <div className="text-sm font-semibold">{t.what}</div>
                  <div className="text-xs text-stone-600"><b>{t.vote}</b>{t.note ? ` — ${t.note}` : ""}</div>
                </li>
              ))}
            </ol>
          </section>
        )}
        {L.compare.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-800">April 27 vs. September 14</h3>
            <table className="w-full overflow-hidden rounded-lg text-left text-xs shadow ring-1 ring-orange-200">
              <thead className="bg-orange-200 text-[10px] uppercase tracking-wider"><tr><th className="p-2"> </th><th className="p-2">Apr 27</th><th className="p-2">Sep 14</th></tr></thead>
              <tbody>{L.compare.map((c) => <tr key={c.row} className="odd:bg-white even:bg-orange-50"><td className="p-2 font-bold">{c.row}</td><td className="p-2">{c.a}</td><td className="p-2">{c.b}</td></tr>)}</tbody>
            </table>
          </section>
        )}
        {L.sweetgrass.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-800">Earlier this year — July 13 (the &ldquo;Sweetgrass&rdquo; night)</h3>
            <ul className="space-y-1 text-sm">{L.sweetgrass.map((s) => <li key={s.what} className="flex justify-between gap-3 rounded bg-white p-2 shadow-sm"><span>{s.what}</span><b className="shrink-0">{s.vote}</b></li>)}</ul>
          </section>
        )}
        {b.series.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-800">Ordinances on this agenda and their earlier readings</h3>
            <div className="space-y-3">
              {b.series.map((s) => (
                <div key={s.slug} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-orange-100">
                  <a href={`/ordinance/${s.slug}`} className="text-sm font-bold text-orange-900 underline-offset-2 hover:underline">{s.title.slice(0, 150)}{s.title.length > 150 ? "…" : ""}</a>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.readings.map((r, i) => (
                      <a key={i} href={r.link ?? undefined} className={`rounded px-1.5 py-1 text-[10px] font-bold ${r.link ? "" : "pointer-events-none"} ${r.date === b.meeting.date ? "ring-2 ring-black" : ""} ${r.stage === "first" ? "bg-sky-200" : r.stage === "second" ? "bg-amber-200" : r.stage === "third" ? "bg-emerald-200" : "bg-stone-200"}`}>
                        {r.date.slice(5)} · {r.stage}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-800">Compared with the previous {b.meeting.bodyName} meetings</h3>
          <table className="w-full text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-stone-500"><tr><th className="p-1">Date</th><th className="p-1">Items</th><th className="p-1">Ordinances</th><th className="p-1">Votes parsed</th><th className="p-1">Runtime</th></tr></thead>
            <tbody>
              <tr className="bg-orange-200 font-bold"><td className="p-1">{b.meeting.date} (this)</td><td className="p-1">{b.analytics.itemCount}</td><td className="p-1">{b.items.filter((i) => i.kind === "ordinance").length}</td><td className="p-1">{b.analytics.votes.total}</td><td className="p-1">{b.meeting.runtimeMin ? `${b.meeting.runtimeMin} min` : "—"}</td></tr>
              {b.analytics.peers.map((p) => <tr key={p.slug} className="odd:bg-white"><td className="p-1"><a className="underline" href={`/episode/${p.slug}`}>{p.date}</a></td><td className="p-1">{p.items}</td><td className="p-1">{p.ordinances}</td><td className="p-1">{p.votes}</td><td className="p-1">{p.runtime ? `${p.runtime} min` : "—"}</td></tr>)}
            </tbody></table>
        </section>
        <Note>Readings are matched up when the clerk reads the same title each time. Where the sources don&apos;t agree, check the minutes.</Note>
        <span className="hidden">{stageTone("first")}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ MONEY */
function Money({ b }: B) {
  const a = b.analytics;
  const max = a.amounts[0]?.amount ?? 1;
  return (
    <div className="min-h-full bg-green-950 p-5 text-green-50">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-xl bg-green-900/60 p-4 ring-1 ring-green-700">
          <div className="text-[10px] font-bold uppercase tracking-widest text-green-300">Dollar amounts on this agenda</div>
          <div className="text-4xl font-black tabular-nums text-green-300">{money(a.amountTotal)}</div>
          <div className="text-xs text-green-200/80">Sum of every &ldquo;not to exceed&rdquo; or contract figure detected in item titles and recommended actions ({a.amounts.length}+ items). A ceiling is not the same as money spent.</div>
        </div>
        {a.amounts.map((x) => (
          <div key={x.itemNo + x.title} className="space-y-1">
            <div className="flex justify-between gap-3 text-sm"><span><Tag tone="green">item {x.itemNo}</Tag> {x.title}</span><b className="tabular-nums">{money(x.amount)}</b></div>
            <div className="h-2 rounded bg-green-900"><div className="h-2 rounded bg-green-400" style={{ width: `${(x.amount / max) * 100}%` }} /></div>
          </div>
        ))}
        {a.amounts.length === 0 && <Note>No dollar amounts were found for this meeting.</Note>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- SCRIPT */
function Script({ b }: B) {
  return (
    <div className="min-h-full bg-stone-200 p-4">
      <div className="mx-auto max-w-2xl bg-white p-8 font-mono text-[13px] leading-relaxed text-black shadow-lg">
        <div className="mb-8 text-center">
          <div className="text-lg font-bold uppercase">{b.show.title}</div>
          <div>{b.show.code}</div>
          <div className="text-xs">&ldquo;Based on the public record&rdquo;</div>
        </div>
        {b.lenses.script.map((l, i) => {
          if (l.t === "scene") return <p key={i} className="mt-6 font-bold uppercase">{l.text}</p>;
          if (l.t === "transition") return <p key={i} className="mt-4 text-right font-bold uppercase">{l.text}</p>;
          if (l.t === "dialogue")
            return (
              <div key={i} className="mx-auto mt-3 max-w-md">
                <div className="text-center font-bold uppercase">{l.who}</div>
                {l.paren && <div className="text-center italic">({l.paren})</div>}
                <p>{l.text}</p>
              </div>
            );
          return <p key={i} className="mt-3">{l.text}</p>;
        })}
        <p className="mt-8 border-t pt-2 text-[10px] italic text-stone-500">Dialogue appears only where the source quotes or paraphrases it; each speaker line is labeled with its source.</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- CALLSHEET */
function CallSheet({ b }: B) {
  const [open, setOpen] = useState<string | null>(null);
  const byNo = new Map(b.items.map((i) => [i.itemNo, i]));
  const kindTone: Record<string, string> = { ordinance: "amber", resolution: "violet", hearing: "red", contract: "blue", bid: "blue", minutes: "slate", procedural: "slate", other: "slate" };
  return (
    <div className="min-h-full bg-sky-950 p-5 text-sky-50">
      <div className="mx-auto max-w-3xl space-y-5">
        {b.show.acts.length === 0 && <Note>The agenda for this meeting hasn&apos;t been broken out item by item.</Note>}
        {b.show.acts.map((a) => (
          <section key={a.n}>
            <h3 className="text-sm font-black uppercase tracking-wider text-sky-300">{a.name}</h3>
            <p className="mb-2 text-xs text-sky-200/80">{a.beat}</p>
            <div className="divide-y divide-sky-900 rounded-lg bg-sky-900/40 ring-1 ring-sky-800">
              {a.items.map((no) => {
                const it = byNo.get(no);
                if (!it) return null;
                const k = it.itemNo + it.pos;
                return (
                  <div key={k} className="p-2">
                    <button onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-start gap-2 text-left text-xs">
                      <span className="w-8 shrink-0 font-mono text-sky-400">{it.itemNo}</span>
                      <span className="flex-1">{open === k ? it.title : it.title.slice(0, 130) + (it.title.length > 130 ? "…" : "")}</span>
                      <Tag tone={kindTone[it.kind] ?? "slate"}>{it.reading ? `${it.reading} reading` : it.kind}</Tag>
                      {it.consent && <Tag tone="outline">consent</Tag>}
                    </button>
                    {open === k && (
                      <div className="mt-1 pl-10 text-[11px] text-sky-200/90">
                        {it.action && <div>Recommended action: <b>{it.action}</b></div>}
                        {it.sponsor && <div>Sponsor: {it.sponsor}</div>}
                        {it.amountUsd ? <div>Figure: {money(it.amountUsd)}</div> : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- FACTCHECK */
function FactCheck({ b }: B) {
  const sevTone = (s: string) => (s === "HIGH" ? "red" : s === "MED" ? "amber" : "slate");
  return (
    <div className="min-h-full bg-rose-950 p-5 text-rose-50">
      <div className="mx-auto max-w-3xl space-y-5">
        {b.provenance.nameWarning && <Note>{b.provenance.nameWarning}</Note>}
        {b.lenses.moments.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-rose-300">Moments to verify against the official minutes</h3>
            {b.lenses.moments.map((m, i) => (
              <div key={i} className="rounded-lg bg-rose-900/50 p-3 text-sm ring-1 ring-rose-800">
                <div className="mb-1 flex flex-wrap items-center gap-2"><b>{m.who}</b><Tag tone="outline">item {m.item}</Tag><Tag tone={m.quote ? "amber" : "slate"}>{m.quote ? "contains quote" : "paraphrase"}</Tag></div>
                <p className="leading-snug">{m.text}</p>
              </div>
            ))}
          </section>
        )}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-rose-300">Automatic warnings (each one cites the document and page)</h3>
          {b.briefs.length === 0 && <Note>No automatic warnings for this meeting.</Note>}
          {b.briefs.filter((x) => x.flags.length || x.quotes.length).map((x) => (
            <div key={x.itemNo + x.title} className="rounded-lg bg-rose-900/40 p-3 ring-1 ring-rose-900">
              <div className="mb-1 text-sm font-bold">Item {x.itemNo} <span className="font-normal text-rose-200/80">— {x.title.slice(0, 100)}</span></div>
              <div className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-rose-200/80">{Object.entries(x.facts).slice(0, 6).map(([k, v]) => <span key={k}><b>{k}</b>: {v.slice(0, 60)}</span>)}</div>
              {x.flags.map((f, i) => <div key={i} className="mt-1 flex gap-2 text-xs"><Tag tone={sevTone(f.sev)}>{SEV_LABEL[f.sev] ?? f.sev}: {flagLabel(f.code)}</Tag><span>{f.msg}</span></div>)}
              {x.quotes.slice(0, 3).map((q, i) => <blockquote key={i} className="mt-1 border-l-2 border-rose-500 pl-2 text-[11px] italic text-rose-100/80">p{q.page}: {q.text}</blockquote>)}
            </div>
          ))}
          <Note>Known limits: acreage can concatenate legal-description numbers (e.g. &ldquo;1,9197.76&rdquo;); &ldquo;year mix&rdquo; is a hint, not a conclusion; scanned pages were read by software and may contain errors.</Note>
        </section>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- JARGON */
function Jargon({ b }: B) {
  const [q, setQ] = useState("");
  const g = b.lenses.glossary.filter((x) => !q || (x.term + x.def).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-full bg-pink-50 p-5 text-stone-900">
      <div className="mx-auto max-w-2xl space-y-3">
        <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up a civic or statutory term…" className="w-full rounded border border-pink-300 bg-white px-3 py-2 text-sm outline-none focus:border-pink-600" />
          <button type="submit" className="rounded bg-pink-700 px-4 py-2 text-xs font-black text-white hover:bg-pink-600">
            Enter ↵
          </button>
        </form>
        {g.map((x) => (
          <div key={x.term} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-pink-100"><div className="font-serif text-lg font-bold text-pink-800">{x.term}</div><p className="text-sm">{x.def}</p></div>
        ))}
        {g.length === 0 && <Note>No matching terms.</Note>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- EVIDENCE */
const SCHED: Record<string, string> = {
  council: "Second and fourth Monday, 6 p.m.",
  special: "Called as needed",
  psc: "First and third Monday, noon",
  finance: "First and third Tuesday, noon",
  cow: "At the discretion of the Governing Body",
  work: "Typically Fridays, noon",
};
function Evidence({ b }: B) {
  const m = b.meeting;
  const [evPhase, setEvPhase] = useState<"intro" | "main" | "outro">("main");
  const cleanMp4 = m.iaMp4Url || (m.mp4Url && !m.mp4Url.includes("granicus.com") ? m.mp4Url : null);
  const toSafeArchiveUrl = (url?: string | null) =>
    !url ? null : url.includes("archive-video.granicus.com") ? cleanMp4 : url.includes("granicus.com") && !url.includes("web.archive.org") ? `https://web.archive.org/web/${url}` : url;
  const links = [
    m.agendaUrl && { label: "Agenda (Wayback / Archive)", url: toSafeArchiveUrl(m.agendaUrl)! },
    m.minutesUrl && { label: "Minutes (Wayback / Archive)", url: toSafeArchiveUrl(m.minutesUrl)! },
    m.iaPageUrl && { label: "Internet Archive Broadcast Item", url: m.iaPageUrl },
    cleanMp4 && { label: "Internet Archive MP4 Stream", url: cleanMp4 },
    ...m.extraLinks.map((l) => ({ label: l.label, url: toSafeArchiveUrl(l.url) ?? l.url })),
  ].filter(Boolean) as { label: string; url: string }[];
  return (
    <div className="min-h-full bg-neutral-900 p-5 text-neutral-100">
      <div className="mx-auto max-w-3xl space-y-5 text-sm">
        <section className="rounded-lg bg-neutral-800 p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Where this meeting video comes from</div>
          <p className="mt-1 text-xs text-neutral-300">
            Older Cheyenne meeting videos come from the Internet Archive's copies of the city's channel, found through a saved copy of the city's meeting page (saved <b>{b.provenance.waybackTs}</b>). The city's own video server blocks direct downloads.
          </p>
          <a className="mt-1 block break-all text-xs text-sky-300 underline" href={b.provenance.waybackUrl} target="_blank" rel="noreferrer">{b.provenance.waybackUrl}</a>
          <details className="mt-2 text-xs"><summary className="cursor-pointer text-neutral-400">All {b.provenance.captures.length} saved copies of this page</summary>
            <ul className="mt-1 columns-2 text-[11px]">{b.provenance.captures.map((c) => <li key={c.ts}><a className="text-sky-300 underline" href={c.url} target="_blank" rel="noreferrer">{c.ts.replace(/(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/, "$1-$2-$3 $4:$5Z")}</a></li>)}</ul>
          </details>
        </section>
        <section className="rounded-lg bg-neutral-800 p-3 text-xs">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-sky-400">How to attend or comment</div>
          <p>
            <b>{SCHED[m.body] ?? "See the city meeting calendar"}</b> · Municipal Building, Council Chambers, 2101 O&rsquo;Neil Ave., Cheyenne. Chambers meetings stream on the City&rsquo;s Facebook and YouTube pages; remote comment is via Zoom (links at cheyennecity.org/ecm). Schedule as stated on the city&rsquo;s Minutes and Agendas page.
          </p>
        </section>
        <section className="rounded-lg bg-neutral-800 p-3 text-xs"><div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Official record</div><p>{b.provenance.official}</p>{b.provenance.watchdog && <><div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-widest text-rose-400">Notes from local watchdogs (not official; may contain errors)</div><p>{b.provenance.watchdog}</p></>}</section>
        <section><div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Original source links</div>
          <div className="flex flex-wrap gap-2">{links.map((l) => <a key={l.url + l.label} href={l.url} target="_blank" rel="noreferrer" className="rounded bg-sky-700 px-2 py-1 text-xs font-semibold hover:bg-sky-600">{l.label} ↗</a>)}{links.length === 0 && <span className="text-xs text-neutral-400">No source links for this meeting.</span>}</div></section>
        {cleanMp4 && (
          <div className="overflow-hidden rounded-xl border-2 border-amber-400/50 bg-[#050912]">
            <div className="flex items-center justify-between border-b-2 border-amber-400 bg-[#09152b] px-3 py-1 text-[10px] font-black uppercase text-amber-300">
              <span>[RWC] THE REAL WINDY CITY · MEETING VIDEO</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEvPhase("intro")} className="rounded bg-white/10 px-2 py-0.5 text-white hover:bg-white/20">Intro</button>
                <button type="button" onClick={() => setEvPhase("main")} className="rounded bg-amber-400 px-2 py-0.5 text-black">Meeting</button>
                <button type="button" onClick={() => setEvPhase("outro")} className="rounded bg-white/10 px-2 py-0.5 text-white hover:bg-white/20">Outro</button>
              </div>
            </div>
            {evPhase === "intro" ? (
              <div className="flex h-56 flex-col items-center justify-center bg-[#061022] p-4 text-center">
                <div className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-black text-black">THE REAL WINDY CITY · CHEYENNE ARCHIVE</div>
                <div className="mt-2 text-lg font-black text-white">{m.bodyName} · {m.date}</div>
                <button type="button" onClick={() => setEvPhase("main")} className="mt-3 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-black text-black">▶ Watch Internet Archive Stream</button>
              </div>
            ) : evPhase === "outro" ? (
              <div className="flex h-56 flex-col items-center justify-center bg-[#061022] p-4 text-center">
                <div className="text-sm font-black uppercase tracking-widest text-amber-300">THE REAL WINDY CITY</div>
                <div className="mt-1 text-xs text-slate-300">Verified Internet Archive Ch. 192 Record · {m.date}</div>
                <button type="button" onClick={() => setEvPhase("main")} className="mt-3 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white">↺ Replay</button>
              </div>
            ) : (
              <div className="relative">
                <video className="w-full bg-black" controls preload="metadata" src={cleanMp4} onEnded={() => setEvPhase("outro")} />
                <div className="pointer-events-none absolute inset-x-3 bottom-11 rounded bg-black/85 px-2.5 py-1 text-center font-mono text-[11px] text-white ring-1 ring-amber-400/30">
                  CC · {m.bodyName} ({m.date}) — Verified Internet Archive Stream &amp; Cleaned Official Minutes
                </div>
              </div>
            )}
            <div className="overflow-hidden border-t-2 border-rose-700 bg-[#0a1931] px-3 py-1 text-[10px] font-bold text-amber-300">
              <div className="ticker-track whitespace-nowrap">
                <span className="pr-12">THE REAL WINDY CITY · {m.bodyName.toUpperCase()} · {m.date} · INTERNET ARCHIVE STREAM · {b.speakerTurns.length} SPEAKER CLIPS IN THE SPEAKER VIDEOS VIEW</span>
                <span className="pr-12">THE REAL WINDY CITY · {m.bodyName.toUpperCase()} · {m.date} · INTERNET ARCHIVE STREAM · {b.speakerTurns.length} SPEAKER CLIPS IN THE SPEAKER VIDEOS VIEW</span>
              </div>
            </div>
          </div>
        )}
        <section><div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Attachments ({b.docs.length})</div>
          <div className="max-h-64 overflow-auto rounded bg-neutral-800 p-2 text-[11px]">
            {b.docs.map((d) => <div key={d.id} className="flex gap-2 border-b border-neutral-700 py-1"><span className="w-10 shrink-0 text-neutral-500">#{d.id}</span><span className="flex-1">{d.title}</span><span className="shrink-0 font-mono text-neutral-500">{d.sha1 ? d.sha1.slice(0, 8) : d.role}</span>{d.ocr && <Tag tone="amber">OCR</Tag>}</div>)}
            {b.docs.length === 0 && <span className="text-neutral-400">No attached documents listed for this meeting.</span>}
          </div></section>
        <section className="text-[11px] text-neutral-400">Data sources: {m.sources.map(sourceLabel).filter((x, i, arr) => arr.indexOf(x) === i).join(", ") || "city meeting list"}. Our rule: if we can&rsquo;t quote a source for it, we don&rsquo;t say it.</section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- CAST */
function sourceLabel(src: string): string {
  if (src === "wayback") return "saved copies of the city website (Wayback Machine)";
  if (src.startsWith("archive.org")) return "Internet Archive meeting videos";
  if (src.includes("cheyenne-archives")) return "The Real Windy City document archive";
  if (src.includes("transcripts")) return "meeting video transcripts";
  if (src === "granicus-index") return "the city's Granicus meeting portal";
  if (src === "official_records" || src === "civic.db") return "official city records";
  return src;
}
const BILLING_LABEL: Record<string, string> = {
  Presiding: "Running the meeting",
  "Title role": "Applicant",
  Starring: "Council members",
  "Co-starring": "Council members",
  "Keeper of the record": "City Clerk",
  "Guest star": "Applicants & representatives",
  Supporting: "City staff",
  Recurring: "Public commenters",
};
function Cast({ b }: B) {
  const order = ["Presiding", "Title role", "Starring", "Co-starring", "Keeper of the record", "Guest star", "Supporting", "Recurring"];
  const labels = [...new Set([...order, ...b.show.cast.map((c) => c.billing)].map((o) => BILLING_LABEL[o] ?? o))];
  const groups = labels.map((g) => [g, b.show.cast.filter((c) => (BILLING_LABEL[c.billing] ?? c.billing) === g)] as const).filter(([, v]) => v.length);
  return (
    <div className="min-h-full bg-violet-950 p-5 text-violet-50">
      <div className="mx-auto max-w-3xl space-y-5">
        {groups.map(([g, list]) => (
          <section key={g}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-300">{g}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((c) => (
                <div key={c.name} className="flex flex-col justify-between gap-2 rounded-lg bg-violet-900/50 p-3 ring-1 ring-violet-800">
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 font-black">{c.name.replace(/^(Dr\.|Mr\.)\s*/, "").slice(0, 1)}</div>
                    <div className="min-w-0"><div className="truncate font-bold">{c.name}</div><div className="text-[11px] uppercase tracking-wider text-violet-300">{c.role}</div>{c.note && <p className="mt-1 text-xs text-violet-100/80">{c.note}</p>}<div className="mt-1 text-[10px] text-violet-400">source: {c.src}</div></div>
                  </div>
                  <div className="flex gap-2 text-[10px] font-bold">
                    <Link href={`/speakers?q=${encodeURIComponent(c.name)}`} className="rounded bg-amber-400 px-2 py-0.5 text-black hover:bg-amber-300">🎙️ Speaker Clips →</Link>
                    <Link href={`/osint?q=${encodeURIComponent(c.name)}`} className="rounded bg-emerald-500/30 px-2 py-0.5 text-emerald-100 hover:bg-emerald-500/50">🕸️ Who&apos;s Who →</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && <Note>No attendance information for this meeting.</Note>}
        <Note>{b.show.castNote}</Note>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- ROUTER */
export function LensView({ lensKey, b }: { lensKey: LensKey; b: EpisodeBundle }) {
  const ref = useRef(null);
  switch (lensKey) {
    case "foundry": return <FoundryLensView b={b} />;
    case "gotham": return <GothamGraphLensView b={b} />;
    case "speakers": return <EpisodeSpeakersLens b={b} />;
    case "provenance": return <ProvenanceFilmsWorkbench catalog={b.provenanceFilms} />;
    case "story": return <Story b={b} />;
    case "tabloid": return <Tabloid b={b} />;
    case "legal": return <Legal b={b} />;
    case "transcript": return <Transcript b={b} />;
    case "analytics": return <Analytics b={b} />;
    case "votes": return <Votes b={b} />;
    case "map": return <MapLens b={b} />;
    case "history": return <History b={b} />;
    case "money": return <Money b={b} />;
    case "script": return <Script b={b} />;
    case "callsheet": return <CallSheet b={b} />;
    case "factcheck": return <FactCheck b={b} />;
    case "jargon": return <Jargon b={b} />;
    case "evidence": return <Evidence b={b} />;
    case "cast": return <Cast b={b} />;
    default: return <div ref={ref} />;
  }
}
