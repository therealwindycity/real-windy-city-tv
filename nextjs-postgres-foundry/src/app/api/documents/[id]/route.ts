import { getDocument } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) return Response.json({ error: "bad id" }, { status: 400 });
  const doc = await getDocument(n);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ id: doc.id, title: doc.title, pages: doc.pages, words: doc.words, url: doc.url, body: doc.body });
}
