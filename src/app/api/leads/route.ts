export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getLeads, getLeadStats } from "@/repositories/lead.repository";
import type { Segment } from "@/domain/lead";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const segment = searchParams.get("segment") as Segment | null;
  const city = searchParams.get("city") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "500");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const [leadsResult, statsResult] = await Promise.all([
    getLeads({ segment: segment ?? undefined, city, search, limit, offset }),
    getLeadStats(),
  ]);

  if (!leadsResult.ok) {
    return NextResponse.json({ error: leadsResult.error.message }, { status: 500 });
  }
  if (!statsResult.ok) {
    return NextResponse.json({ error: statsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: leadsResult.value, stats: statsResult.value });
}
