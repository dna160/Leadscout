export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { listRuns } from "@/repositories/run.repository";

export async function GET() {
  const result = await listRuns(20);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json(result.value);
}
