export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { patchKeywordSet, removeKeywordSet } from "@/services/keywordSet.service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await patchKeywordSet(id, body);
  if (!result.ok) {
    const status = result.error.code === "NOT_FOUND" ? 404 : result.error.code === "VALIDATION_ERROR" ? 400 : 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.value);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await removeKeywordSet(id);
  if (!result.ok) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return new NextResponse(null, { status: 204 });
}
