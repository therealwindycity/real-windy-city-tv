import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EpisodeStage from "@/components/EpisodeStage";
import { getEpisodeBundle } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getEpisodeBundle(slug);
  return b ? { title: `${b.show.title} — ${b.show.code} · The Real Windy City`, description: b.show.logline } : { title: "Episode not found" };
}

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getEpisodeBundle(slug);
  if (!b) notFound();
  return <EpisodeStage b={b} />;
}
