import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Now Streaming" },
  { href: "/episodes", label: "Episodes (1,615)" },
  { href: "/speakers", label: "🎙️ Speaker Videos (2,483)" },
  { href: "/osint", label: "🕸️ OSINT Entity Graph" },
  { href: "/ordinances", label: "📜 Ordinances: 1st→Final" },
  { href: "/documents", label: "🏛️ Foundry Docs (6,371)" },
  { href: "/provenance", label: "🎥 Provenance Films" },
  { href: "/cast", label: "The Cast" },
];

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-amber-400 text-sm font-black text-black">RWC</span>
            <span className="leading-none">
              <span className="block text-sm font-black uppercase tracking-[0.18em]">The Real Windy City</span>
              <span className="block text-[10px] uppercase tracking-[0.26em] text-amber-300">Civic Broadcast, OSINT &amp; Foundry · Cheyenne, WY</span>
            </span>
          </Link>
          <nav className="ml-auto flex flex-wrap gap-1 text-xs font-bold sm:text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded px-2.5 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-slate-400">
        <p>
          100% Zero-Gap Primary Public Record (2008–2026): 1,615 City of Cheyenne meetings (833 Internet Archive Ch. 192 MP4s), 8,983 docket items, 6,371 Clerk Minutes &amp; Supporting Packet PDFs, 2,483 &le;3-min C-SPAN branded speaker video segments across 109 verified speakers, 51 OSINT cross-referenced civic entities, 275 multi-reading ordinances, and 14 manual click-path provenance films. Nothing here is legal advice.
        </p>
      </footer>
    </div>
  );
}
