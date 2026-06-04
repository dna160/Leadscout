export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAllKeywordSets, createNewKeywordSet } from "@/services/keywordSet.service";

export async function GET() {
  const result = await getAllKeywordSets();
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json(result.value);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createNewKeywordSet(body);
  if (!result.ok) {
    const status = result.error.code === "VALIDATION_ERROR" ? 400 : 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value, { status: 201 });
}
