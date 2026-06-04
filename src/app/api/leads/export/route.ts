export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAllLeadsForExport } from "@/repositories/lead.repository";
import Papa from "papaparse";

export async function GET() {
  const result = await getAllLeadsForExport();
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const csv = Papa.unparse(
    result.value.map((lead) => ({
      name: lead.name,
      category: lead.category ?? "",
      city: lead.city ?? "",
      segment: lead.segment ?? "",
      phone: lead.phone ?? "",
      whatsapp: lead.whatsapp ?? "",
      email: lead.email ?? "",
      instagram: lead.instagram ?? "",
      website: lead.website ?? "",
      maps_url: lead.maps_url ?? "",
      rating: lead.rating ?? "",
      reviews: lead.reviews ?? "",
      created_at: lead.created_at.toISOString(),
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leadscout-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
