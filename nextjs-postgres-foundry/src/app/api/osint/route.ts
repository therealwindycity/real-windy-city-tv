import { NextResponse } from "next/server";
import { listOsintEntities } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 25) || 25));
  const data = await listOsintEntities({ category, q, limit, offset: (page - 1) * limit });
  return NextResponse.json({ page, limit, ...data });
}
