import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/episodes", label: "📺 Meetings" },
  { href: "/speakers", label: "🎙️ Speaker Clips" },
  { href: "/osint", label: "🕸️ Who's Who" },
  { href: "/ordinances", label: "📜 Ordinances" },
  { href: "/documents", label: "📄 Documents" },
  { href: "/provenance", label: "🎥 Where the Records Come From" },
  { href: "/cast", label: "🎭 People" },
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
              <span className="block text-[10px] uppercase tracking-[0.26em] text-amber-300">City meetings, speakers &amp; records · Cheyenne, WY</span>
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
          Built from Cheyenne's public meeting records, 2008–2026: agendas, minutes, attached documents and meeting video. Nothing here is legal advice.
        </p>
      </footer>
    </div>
  );
}
