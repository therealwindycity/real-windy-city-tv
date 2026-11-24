import { notFound } from "next/navigation";
import { getEpisodeBundle } from "@/lib/bundle";
import { LENS_BY_KEY, isLensKey } from "@/lib/lens-meta";
import { LensView } from "@/components/lenses";

export const dynamic = "force-dynamic";

export default async function EmbedLens({ params }: { params: Promise<{ slug: string; lens: string }> }) {
  const { slug, lens } = await params;
  if (!isLensKey(lens)) notFound();
  const b = await getEpisodeBundle(slug);
  if (!b) notFound();
  const meta = LENS_BY_KEY[lens];
  return (
    <div className="flex h-screen flex-col bg-[#07090f]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-xs" style={{ borderTopColor: meta.accent, borderTopWidth: 3 }}>
        <span>{meta.icon}</span>
        <b>{meta.name}</b>
        <span className="text-slate-400">· {b.show.code} · {b.meeting.date} · {b.show.title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LensView lensKey={lens} b={b} />
      </div>
    </div>
  );
}
